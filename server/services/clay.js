const axios = require('axios');
const { pool } = require('../db');

const BASE_URL = 'https://api.clay.com/public/v0';

function client() {
  return axios.create({
    baseURL: BASE_URL,
    headers: {
      'Content-Type': 'application/json',
      'clay-api-key': process.env.CLAY_API_KEY,
    },
  });
}

// Returns the live query grammar + field catalog as markdown. Not filterable itself,
// but needed to know which fields/operators are currently valid.
async function getQueryReference() {
  const { data } = await client().get('/search/query-mode/reference');
  return data.reference;
}

async function createSearch(query) {
  const { data } = await client().post('/search/query-mode', { query });
  return data; // { search_id, source_type }
}

async function runSearch(searchId, limit = 100) {
  const { data } = await client().post(`/search/query-mode/${searchId}/run`, { limit });
  return data; // { data, has_more, source_type, exhaustion_reason, period_quota }
}

// Pages through a query-mode search until has_more is false or maxResults is hit.
// Clay's iterator can return an empty page with has_more still true (results not
// ready yet) -- tolerate a few of those before concluding the search is exhausted,
// so we don't give up on real results, but cap it so a genuinely-empty search
// doesn't spin forever burning quota.
async function searchAll(query, { pageSize = 100, maxResults = 100, maxEmptyPages = 4 } = {}) {
  const { search_id: searchId } = await createSearch(query);
  const results = [];
  let hasMore = true;
  let periodQuota = null;
  let consecutiveEmptyPages = 0;

  while (hasMore && results.length < maxResults && consecutiveEmptyPages < maxEmptyPages) {
    const remaining = maxResults - results.length;
    const page = await runSearch(searchId, Math.min(pageSize, remaining));
    periodQuota = page.period_quota;
    hasMore = page.has_more;

    if (page.data.length === 0) {
      consecutiveEmptyPages += 1;
      continue;
    }
    consecutiveEmptyPages = 0;
    results.push(...page.data);
  }

  return { results, periodQuota };
}

function escapeQueryString(value) {
  return String(value).replace(/"/g, '\\"');
}

// Shared by the manual /api/clay/search route and the automated pipeline -- maps one
// raw Clay company-search result into our schema and upserts by domain.
async function upsertCompanyFromClayResult(c) {
  const notesParts = [];
  if (c.size) notesParts.push(`size: ${c.size}`);
  if (c.annual_revenue) notesParts.push(`revenue: ${c.annual_revenue}`);
  if (c.total_funding_amount_range_usd) notesParts.push(`funding: ~$${Number(c.total_funding_amount_range_usd).toLocaleString()}`);

  const company = {
    name: c.name,
    domain: c.domain ? String(c.domain).trim().toLowerCase() : null,
    website: c.domain ? `https://${c.domain}` : null,
    linkedin_url: c.linkedin_url || null,
    industry: c.industry || null,
    location: c.location || null,
    total_raised: c.total_funding_amount_range_usd || null,
    notes: notesParts.join('; ') || null,
  };
  if (!company.name) return null;

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
  return rows[0];
}

module.exports = { getQueryReference, createSearch, runSearch, searchAll, upsertCompanyFromClayResult, escapeQueryString };
