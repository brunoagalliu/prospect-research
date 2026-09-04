const { pool } = require('../db');
const clay = require('./clay');
const apollo = require('./apollo');
const hubspot = require('./hubspot');
const instantly = require('./instantly');
const { computeScore } = require('./scoring');
const { refreshHiringSignals } = require('./hiringSignal');
const { logActivity } = require('./activityLog');

// The validated Tier 1 sourcing query from the initial manual sweep -- kept as the
// standing definition of what this pipeline sources. Employee count uses the exact
// field AND the size bucket together since they can disagree for large/stale records
// (see clay-api-findings memory); tech/software industries anchor out of-vertical noise
// (recruiting/staffing agencies structurally pass the headcount+title filters otherwise).
const SOURCING_QUERY = `select from companies where estimated_employee_count >= 20 and estimated_employee_count <= 70 and not company_size in ("201-500", "501-1,000", "1,001-5,000", "5,001-10,000", "10,001+") and industry in ("Software Development", "IT Services and IT Consulting", "Technology, Information and Internet", "Data Infrastructure and Analytics", "Business Intelligence Platforms") and people.count(is_current = true and job_title is_similar_to ("marketing")) >= 1 and people.count(is_current = true and job_title is_similar_to ("marketing")) <= 3 and not people.exists(is_current = true and job_title is_similar_to ("Revenue Operations", "RevOps", "GTM Engineer", "Growth Engineer", "Marketing Operations")) and people.count(is_current = true and job_title is_similar_to ("SDR", "Account Executive", "Sales Development", "Business Development")) >= 2`;

const DEFAULT_BUYING_COMMITTEE_TITLES = [
  'CEO', 'Founder', 'Head of Marketing', 'VP Marketing',
  'Head of Growth', 'VP Sales', 'Head of Sales', 'CRO',
];

async function getState(key) {
  const { rows } = await pool.query('SELECT value FROM pipeline_state WHERE key = $1', [key]);
  return rows[0]?.value || null;
}

async function setState(key, value) {
  await pool.query(
    `INSERT INTO pipeline_state (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [key, value]
  );
}

// Persists the Clay search_id and pages forward through it incrementally each run,
// rather than re-running the query fresh (which would just return the same companies
// every time) or embedding an ever-growing "not domain in (...)" exclusion list.
async function sourceNewCompanies(count) {
  let searchId = await getState('clay_sourcing_search_id');
  if (!searchId) {
    const created = await clay.createSearch(SOURCING_QUERY);
    searchId = created.search_id;
    await setState('clay_sourcing_search_id', searchId);
  }

  let page;
  try {
    page = await clay.runSearch(searchId, count);
  } catch {
    // search_id likely expired -- start fresh and try once more.
    const created = await clay.createSearch(SOURCING_QUERY);
    searchId = created.search_id;
    await setState('clay_sourcing_search_id', searchId);
    page = await clay.runSearch(searchId, count);
  }

  if (page.data.length === 0 && !page.has_more) {
    await setState('clay_sourcing_search_id', ''); // exhausted -- start fresh next run
  }

  let inserted = 0;
  for (const c of page.data) {
    const row = await clay.upsertCompanyFromClayResult(c);
    if (row) inserted += 1;
  }

  if (inserted > 0) {
    await logActivity({
      source: 'clay', action: 'source_companies', count: inserted,
      cost: page.period_quota ? { quota_used_to_date: page.period_quota.used, quota_remaining: page.period_quota.remaining } : null,
    });
  }
  return { fetched: page.data.length, inserted };
}

async function enrichCompanies(limit) {
  const { rows: companies } = await pool.query(
    `SELECT id, domain FROM companies WHERE domain IS NOT NULL AND employee_count IS NULL ORDER BY id LIMIT $1`,
    [limit]
  );

  let matched = 0;
  for (const company of companies) {
    let org;
    try {
      org = await apollo.enrichOrganization(company.domain);
    } catch {
      continue;
    }
    if (!org) continue;

    const latestFundingEvent = org.funding_events?.[0];
    const growthRatio = org.organization_headcount_twelve_month_growth;
    await pool.query(
      `UPDATE companies SET
         employee_count = COALESCE($1, employee_count),
         headcount_growth_pct = COALESCE($2, headcount_growth_pct),
         funding_stage = COALESCE($3, funding_stage),
         total_raised = COALESCE($4, total_raised),
         tech_stack = COALESCE($5, tech_stack),
         updated_at = NOW()
       WHERE id = $6`,
      [
        org.estimated_num_employees ?? null,
        growthRatio != null ? Math.round(growthRatio * 1000) / 10 : null,
        latestFundingEvent?.type || org.latest_funding_stage || null,
        org.total_funding ?? null,
        org.current_technologies?.length ? [...new Set(org.current_technologies.map((t) => t.name))].slice(0, 30) : null,
        company.id,
      ]
    );
    matched += 1;
  }

  if (matched > 0) {
    await logActivity({ source: 'apollo', action: 'enrich_companies', count: matched, cost: null });
  }
  return { checked: companies.length, matched };
}

async function fillMarketingHeadcount(limit) {
  const { rows: companies } = await pool.query(
    `SELECT id, domain FROM companies WHERE domain IS NOT NULL AND marketing_headcount IS NULL ORDER BY id LIMIT $1`,
    [limit]
  );

  const maxCount = 10;
  let lastQuota = null;
  for (const company of companies) {
    const query = `select from people where clay.filter_to_companies(("${clay.escapeQueryString(company.domain)}")) and experiences.any(is_current = true and job_title is_similar_to ("marketing"))`;
    const { results: people, periodQuota } = await clay.searchAll(query, { pageSize: maxCount, maxResults: maxCount });
    lastQuota = periodQuota || lastQuota;
    await pool.query('UPDATE companies SET marketing_headcount = $1, updated_at = NOW() WHERE id = $2', [people.length, company.id]);
  }

  if (companies.length > 0) {
    await logActivity({
      source: 'clay', action: 'marketing_headcount', count: companies.length,
      cost: lastQuota ? { quota_used_to_date: lastQuota.used, quota_remaining: lastQuota.remaining } : null,
    });
  }
  return { checked: companies.length };
}

async function recomputeAllScores() {
  const { rows: companies } = await pool.query('SELECT * FROM companies');
  for (const c of companies) {
    await pool.query('UPDATE companies SET score = $1, updated_at = NOW() WHERE id = $2', [computeScore(c), c.id]);
  }
  return { updated: companies.length };
}

async function findContacts(limitCompanies) {
  const { rows: companies } = await pool.query(
    `SELECT c.id, c.name, c.domain FROM companies c
     WHERE c.domain IS NOT NULL AND NOT EXISTS (SELECT 1 FROM prospects p WHERE p.company_id = c.id)
     ORDER BY c.id
     LIMIT $1`,
    [limitCompanies]
  );

  const titleList = DEFAULT_BUYING_COMMITTEE_TITLES.map((t) => `"${clay.escapeQueryString(t)}"`).join(', ');
  const maxPerCompany = 2;
  let inserted = 0;
  let lastQuota = null;

  for (const company of companies) {
    const query = `select from people where clay.filter_to_companies(("${clay.escapeQueryString(company.domain)}")) and experiences.any(is_current = true and job_title is_similar_to (${titleList}))`;
    const { results: people, periodQuota } = await clay.searchAll(query, { pageSize: maxPerCompany, maxResults: maxPerCompany });
    lastQuota = periodQuota || lastQuota;

    for (const person of people) {
      const experience = person.matched_experiences?.[0];
      await pool.query(
        `INSERT INTO prospects (name, title, company, company_id, source, status)
         VALUES ($1, $2, $3, $4, 'Clay', 'new')`,
        [person.name, experience?.title || null, company.name, company.id]
      );
      inserted += 1;
    }
  }

  if (inserted > 0) {
    await logActivity({
      source: 'clay', action: 'find_contacts', count: inserted,
      cost: lastQuota ? { quota_used_to_date: lastQuota.used, quota_remaining: lastQuota.remaining } : null,
    });
  }
  return { companies_checked: companies.length, inserted };
}

// "matched" means got email OR linkedin_url -- Apollo returns linkedin_url on the person
// independent of email_status, so a person can match with no email but a real LinkedIn.
async function enrichContactEmails(limit) {
  const { rows: contacts } = await pool.query(
    `SELECT p.id, p.name, c.domain FROM prospects p
     JOIN companies c ON c.id = p.company_id
     WHERE (p.email IS NULL OR p.linkedin_url IS NULL) AND c.domain IS NOT NULL
     ORDER BY p.id
     LIMIT $1`,
    [limit]
  );

  let matched = 0;
  let creditsConsumed = 0;
  for (let i = 0; i < contacts.length; i += 10) {
    const batch = contacts.slice(i, i + 10);
    const response = await apollo.bulkMatch(batch.map((c) => ({ name: c.name, domain: c.domain })));
    creditsConsumed += response.credits_consumed || 0;

    for (let idx = 0; idx < batch.length; idx += 1) {
      const match = response.matches[idx];
      if (!match?.email && !match?.linkedin_url) continue;
      await pool.query(
        `UPDATE prospects SET email = COALESCE($1, email), linkedin_url = COALESCE(linkedin_url, $2), apollo_person_id = COALESCE($3, apollo_person_id), updated_at = NOW() WHERE id = $4`,
        [match.email || null, match.linkedin_url || null, match.id || null, batch[idx].id]
      );
      matched += 1;
    }
  }

  if (contacts.length > 0) {
    await logActivity({ source: 'apollo', action: 'enrich_emails', count: matched, cost: { credits_consumed: creditsConsumed } });
  }
  return { checked: contacts.length, matched };
}

async function requestContactPhones(limit) {
  if (!process.env.APOLLO_WEBHOOK_SECRET || !process.env.RAILWAY_PUBLIC_DOMAIN) {
    return { skipped: 'APOLLO_WEBHOOK_SECRET or RAILWAY_PUBLIC_DOMAIN not set' };
  }
  const webhookUrl = `https://${process.env.RAILWAY_PUBLIC_DOMAIN}/webhooks/apollo-phone?token=${process.env.APOLLO_WEBHOOK_SECRET}`;

  const { rows: contacts } = await pool.query(
    `SELECT p.id, p.name, c.domain FROM prospects p
     JOIN companies c ON c.id = p.company_id
     WHERE p.phone IS NULL AND c.domain IS NOT NULL
     ORDER BY p.id
     LIMIT $1`,
    [limit]
  );

  let requested = 0;
  let creditsConsumed = 0;
  for (let i = 0; i < contacts.length; i += 10) {
    const batch = contacts.slice(i, i + 10);
    const response = await apollo.bulkMatch(batch.map((c) => ({ name: c.name, domain: c.domain })), { revealPhoneNumber: true, webhookUrl });
    creditsConsumed += response.credits_consumed || 0;

    for (let idx = 0; idx < batch.length; idx += 1) {
      const match = response.matches[idx];
      if (!match?.id) continue;
      await pool.query('UPDATE prospects SET apollo_person_id = $1, updated_at = NOW() WHERE id = $2', [match.id, batch[idx].id]);
      requested += 1;
    }
  }

  if (contacts.length > 0) {
    await logActivity({ source: 'apollo', action: 'request_phones', count: requested, cost: { credits_consumed: creditsConsumed } });
  }
  return { checked: contacts.length, requested }; // phone numbers land later via webhook
}

async function syncToHubspot(limitCompanies, limitContacts) {
  await hubspot.ensureCompanyProperties(); // idempotent

  const { rows: companies } = await pool.query(
    `SELECT * FROM companies WHERE domain IS NOT NULL AND hubspot_id IS NULL ORDER BY id LIMIT $1`,
    [limitCompanies]
  );
  let companiesSynced = 0;
  for (const c of companies) {
    const properties = {
      name: c.name,
      domain: c.domain,
      website: c.website || undefined,
      numberofemployees: c.employee_count ?? undefined,
      pr_tier: c.tier ?? undefined,
      pr_score: c.score ?? undefined,
      pr_industry: c.industry || undefined,
      pr_marketing_headcount: c.marketing_headcount ?? undefined,
      pr_has_ops_hire: String(c.has_ops_hire),
      pr_hiring_signal: String(c.hiring_signal),
      pr_hiring_signal_titles: c.hiring_signal_titles || undefined,
      pr_headcount_growth_pct: c.headcount_growth_pct ?? undefined,
      pr_funding_stage: c.funding_stage || undefined,
      pr_total_raised: c.total_raised ?? undefined,
      pr_tech_stack: c.tech_stack?.join(', ') || undefined,
      pr_source: c.source || undefined,
    };
    Object.keys(properties).forEach((k) => properties[k] === undefined && delete properties[k]);

    const hsCompany = await hubspot.upsertCompanyByDomain(c.domain, properties);
    await pool.query('UPDATE companies SET hubspot_id = $1, updated_at = NOW() WHERE id = $2', [hsCompany.id, c.id]);
    companiesSynced += 1;
  }

  const { rows: contacts } = await pool.query(
    `SELECT p.*, c.hubspot_id AS company_hubspot_id FROM prospects p
     LEFT JOIN companies c ON c.id = p.company_id
     WHERE p.email IS NOT NULL AND p.hubspot_id IS NULL
     ORDER BY p.id
     LIMIT $1`,
    [limitContacts]
  );
  let contactsSynced = 0;
  for (const c of contacts) {
    const [firstname, ...rest] = c.name.split(' ');
    const properties = { email: c.email, firstname, lastname: rest.join(' ') || undefined, jobtitle: c.title || undefined, phone: c.phone || undefined };
    Object.keys(properties).forEach((k) => properties[k] === undefined && delete properties[k]);

    const hsContact = await hubspot.upsertContactByEmail(c.email, properties);
    if (c.company_hubspot_id) await hubspot.associateContactToCompany(hsContact.id, c.company_hubspot_id);
    await pool.query('UPDATE prospects SET hubspot_id = $1, updated_at = NOW() WHERE id = $2', [hsContact.id, c.id]);
    contactsSynced += 1;
  }

  if (companiesSynced > 0 || contactsSynced > 0) {
    await logActivity({
      source: 'hubspot', action: 'sync', count: companiesSynced + contactsSynced, cost: null,
      detail: { companies_synced: companiesSynced, contacts_synced: contactsSynced },
    });
  }
  return { companies_synced: companiesSynced, contacts_synced: contactsSynced };
}

// Skips gracefully (not an error) until a campaign is configured via
// POST /api/instantly/config -- there's nothing to sync into otherwise.
async function syncToInstantly(limit) {
  const { rows: stateRows } = await pool.query(`SELECT value FROM pipeline_state WHERE key = 'instantly_campaign_id'`);
  const campaignId = stateRows[0]?.value || null;
  if (!campaignId) return { skipped: 'no Instantly campaign configured yet' };

  const { rows: contacts } = await pool.query(
    `SELECT p.*, c.name AS company_name, c.website, c.tier, c.score, c.industry,
            c.hiring_signal, c.hiring_signal_titles, c.marketing_headcount, c.funding_stage
     FROM prospects p
     LEFT JOIN companies c ON c.id = p.company_id
     WHERE p.email IS NOT NULL AND p.instantly_id IS NULL
     ORDER BY p.id
     LIMIT $1`,
    [limit]
  );

  let synced = 0;
  for (const c of contacts) {
    const [firstName, ...rest] = c.name.split(' ');
    const lead = {
      email: c.email,
      first_name: firstName,
      last_name: rest.join(' ') || undefined,
      company_name: c.company_name || undefined,
      website: c.website || undefined,
      custom_variables: {
        title: c.title || undefined,
        phone: c.phone || undefined,
        linkedin_url: c.linkedin_url || undefined,
        company_tier: c.tier ?? undefined,
        company_score: c.score ?? undefined,
        company_industry: c.industry || undefined,
        hiring_signal: c.hiring_signal ? c.hiring_signal_titles || 'true' : undefined,
        marketing_headcount: c.marketing_headcount ?? undefined,
        funding_stage: c.funding_stage || undefined,
      },
    };
    Object.keys(lead.custom_variables).forEach((k) => lead.custom_variables[k] === undefined && delete lead.custom_variables[k]);
    Object.keys(lead).forEach((k) => lead[k] === undefined && delete lead[k]);

    const created = await instantly.upsertLead(campaignId, lead);
    await pool.query('UPDATE prospects SET instantly_id = $1, updated_at = NOW() WHERE id = $2', [created.id, c.id]);
    synced += 1;
  }

  if (synced > 0) {
    await logActivity({ source: 'instantly', action: 'sync', count: synced, cost: null });
  }
  return { synced };
}

// One daily cycle through the whole pipeline. Each stage is capped and independently
// wrapped so a failure in one (e.g. HubSpot down) doesn't block the others from running.
// Recorded to pipeline_runs so it's visible in the dashboard, not just server logs.
async function runDailyPipeline({ newCompaniesPerRun = 10 } = {}) {
  const summary = {};
  const startedAt = new Date();
  const { rows: runRows } = await pool.query(
    'INSERT INTO pipeline_runs (started_at) VALUES ($1) RETURNING id',
    [startedAt]
  );
  const runId = runRows[0].id;

  async function stage(name, fn) {
    try {
      summary[name] = await fn();
    } catch (err) {
      summary[name] = { error: err.response?.data?.message || err.message };
    }
  }

  try {
    await stage('sourced', () => sourceNewCompanies(newCompaniesPerRun));
    await stage('company_enrichment', () => enrichCompanies(15));
    await stage('marketing_headcount', () => fillMarketingHeadcount(15));
    await stage('hiring_signals', () => refreshHiringSignals());
    await stage('scores', () => recomputeAllScores());
    await stage('contacts_found', () => findContacts(15));
    await stage('contact_emails', () => enrichContactEmails(20));
    await stage('contact_phones', () => requestContactPhones(20));
    await stage('hubspot_sync', () => syncToHubspot(20, 20));
    await stage('instantly_sync', () => syncToInstantly(20));

    await pool.query(
      'UPDATE pipeline_runs SET finished_at = NOW(), summary = $1 WHERE id = $2',
      [JSON.stringify(summary), runId]
    );
  } catch (err) {
    await pool.query(
      'UPDATE pipeline_runs SET finished_at = NOW(), summary = $1, error = $2 WHERE id = $3',
      [JSON.stringify(summary), err.message, runId]
    );
    throw err;
  }

  return summary;
}

module.exports = { runDailyPipeline };
