const express = require('express');
const { pool } = require('../db');
const clay = require('../services/clay');
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

module.exports = router;
