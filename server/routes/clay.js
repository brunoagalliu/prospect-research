const express = require('express');
const { pool } = require('../db');
const clay = require('../services/clay');
const { refreshHiringSignals } = require('../services/hiringSignal');
const router = express.Router();

// Live field catalog + query grammar for Clay's search DSL. Costs no search quota.
router.get('/search/reference', async (req, res, next) => {
  try {
    const reference = await clay.getQueryReference();
    res.json({ reference });
  } catch (err) {
    next(err);
  }
});

// Also run automatically on a schedule (see index.js) -- exposed here too so it can be
// triggered on demand without waiting for the next scheduled run.
router.post('/refresh-hiring-signals', async (req, res, next) => {
  try {
    const result = await refreshHiringSignals();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Runs a Clay search-query-DSL string against Clay's GTM database.
// dry_run (default true) previews matches without writing to our DB.
router.post('/search', async (req, res, next) => {
  try {
    await runClaySearch(req, res);
  } catch (err) {
    next(err);
  }
});

async function runClaySearch(req, res) {
  const { query, max_results = 100, page_size = 100, dry_run = true } = req.body;
  if (!query) return res.status(400).json({ message: 'query is required.' });

  const { results, periodQuota } = await clay.searchAll(query, {
    pageSize: page_size,
    maxResults: max_results,
  });

  const companies = results.map((c) => {
    const notesParts = [];
    if (c.size) notesParts.push(`size: ${c.size}`);
    if (c.annual_revenue) notesParts.push(`revenue: ${c.annual_revenue}`);
    if (c.total_funding_amount_range_usd) notesParts.push(`funding: ~$${Number(c.total_funding_amount_range_usd).toLocaleString()}`);

    return {
      name: c.name,
      domain: c.domain ? String(c.domain).trim().toLowerCase() : null,
      website: c.domain ? `https://${c.domain}` : null,
      linkedin_url: c.linkedin_url || null,
      industry: c.industry || null,
      location: c.location || null,
      total_raised: c.total_funding_amount_range_usd || null,
      notes: notesParts.join('; ') || null,
    };
  });

  if (dry_run) {
    return res.json({ dry_run: true, count: companies.length, period_quota: periodQuota, companies });
  }

  const inserted = [];
  for (const company of companies) {
    if (!company.name) continue;

    const { rows } = await pool.query(
      `INSERT INTO companies (name, domain, website, linkedin_url, industry, location, total_raised, notes, source, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'Clay','new')
       ON CONFLICT (domain) WHERE domain IS NOT NULL DO UPDATE SET
         name         = EXCLUDED.name,
         website      = EXCLUDED.website,
         linkedin_url = EXCLUDED.linkedin_url,
         industry     = EXCLUDED.industry,
         location     = EXCLUDED.location,
         total_raised = EXCLUDED.total_raised,
         notes        = EXCLUDED.notes,
         updated_at   = NOW()
       RETURNING *`,
      [company.name, company.domain, company.website, company.linkedin_url,
       company.industry, company.location, company.total_raised, company.notes]
    );
    inserted.push(rows[0]);
  }

  res.json({ dry_run: false, count: companies.length, inserted: inserted.length, period_quota: periodQuota, companies: inserted });
}

const DEFAULT_BUYING_COMMITTEE_TITLES = [
  'CEO', 'Founder', 'Head of Marketing', 'VP Marketing',
  'Head of Growth', 'VP Sales', 'Head of Sales', 'CRO',
];

function escapeQueryString(value) {
  return String(value).replace(/"/g, '\\"');
}

// Finds buying-committee people (name/title/current company only -- Clay Search has no
// email or phone data) for companies that don't have any contacts linked yet, and links
// each contact to its company via company_id (queried one company at a time so the
// mapping is unambiguous -- batched results don't expose which input domain matched).
router.post('/search/contacts', async (req, res, next) => {
  try {
    const {
      titles = DEFAULT_BUYING_COMMITTEE_TITLES,
      max_per_company = 2,
      limit_companies = 10,
      dry_run = true,
    } = req.body;

    const { rows: companies } = await pool.query(
      `SELECT c.id, c.name, c.domain FROM companies c
       WHERE c.domain IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM prospects p WHERE p.company_id = c.id)
       ORDER BY c.id
       LIMIT $1`,
      [limit_companies]
    );

    const titleList = titles.map((t) => `"${escapeQueryString(t)}"`).join(', ');
    const results = [];
    let periodQuota = null;

    for (const company of companies) {
      const query = `select from people where clay.filter_to_companies(("${escapeQueryString(company.domain)}")) and experiences.any(is_current = true and job_title is_similar_to (${titleList}))`;
      const { results: people, periodQuota: quota } = await clay.searchAll(query, {
        pageSize: max_per_company,
        maxResults: max_per_company,
      });
      periodQuota = quota;

      for (const person of people) {
        const experience = person.matched_experiences?.[0];
        results.push({
          name: person.name,
          title: experience?.title || null,
          company: company.name,
          company_id: company.id,
          location: person.location?.name || null,
        });
      }
    }

    if (dry_run) {
      return res.json({ dry_run: true, companies_checked: companies.length, count: results.length, period_quota: periodQuota, contacts: results });
    }

    const inserted = [];
    for (const contact of results) {
      const { rows } = await pool.query(
        `INSERT INTO prospects (name, title, company, company_id, source, status)
         VALUES ($1, $2, $3, $4, 'Clay', 'new')
         RETURNING *`,
        [contact.name, contact.title, contact.company, contact.company_id]
      );
      inserted.push(rows[0]);
    }

    res.json({ dry_run: false, companies_checked: companies.length, count: results.length, inserted: inserted.length, period_quota: periodQuota, contacts: inserted });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
