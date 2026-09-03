const express = require('express');
const { pool } = require('../db');
const hubspot = require('../services/hubspot');
const router = express.Router();

// Creates the pr_* custom properties on the Companies object. Idempotent -- safe to
// call again after adding new properties to the list in services/hubspot.js.
router.post('/setup', async (req, res, next) => {
  try {
    const created = await hubspot.ensureCompanyProperties();
    res.json({ created });
  } catch (err) {
    next(err);
  }
});

// Pushes companies to HubSpot (search-by-domain, then create or update), storing the
// HubSpot record id back on our row so re-syncing updates in place.
router.post('/sync-companies', async (req, res, next) => {
  try {
    const { limit = 20, resync = false, dry_run = true } = req.body;

    const { rows: companies } = await pool.query(
      `SELECT * FROM companies
       WHERE domain IS NOT NULL ${resync ? '' : 'AND hubspot_id IS NULL'}
       ORDER BY id
       LIMIT $1`,
      [limit]
    );

    if (dry_run) {
      return res.json({ dry_run: true, would_sync: companies.length, companies: companies.map((c) => ({ id: c.id, name: c.name, domain: c.domain })) });
    }

    const results = [];
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
      results.push({ id: c.id, name: c.name, hubspot_id: hsCompany.id });
    }

    res.json({ dry_run: false, synced: results.length, results });
  } catch (err) {
    next(err);
  }
});

// Pushes contacts to HubSpot (upsert by email -- the only reliable dedup key available)
// and associates each with its company's HubSpot record, if that company has synced.
router.post('/sync-contacts', async (req, res, next) => {
  try {
    const { limit = 20, dry_run = true } = req.body;

    const { rows: contacts } = await pool.query(
      `SELECT p.*, c.hubspot_id AS company_hubspot_id, c.name AS company_name
       FROM prospects p
       LEFT JOIN companies c ON c.id = p.company_id
       WHERE p.email IS NOT NULL AND p.hubspot_id IS NULL
       ORDER BY p.id
       LIMIT $1`,
      [limit]
    );

    if (dry_run) {
      return res.json({
        dry_run: true,
        would_sync: contacts.length,
        contacts: contacts.map((c) => ({ id: c.id, name: c.name, email: c.email, company: c.company_name, company_synced: Boolean(c.company_hubspot_id) })),
      });
    }

    const results = [];
    for (const c of contacts) {
      const [firstname, ...rest] = c.name.split(' ');
      const properties = {
        email: c.email,
        firstname,
        lastname: rest.join(' ') || undefined,
        jobtitle: c.title || undefined,
        phone: c.phone || undefined,
      };
      Object.keys(properties).forEach((k) => properties[k] === undefined && delete properties[k]);

      const hsContact = await hubspot.upsertContactByEmail(c.email, properties);
      let associated = false;
      if (c.company_hubspot_id) {
        await hubspot.associateContactToCompany(hsContact.id, c.company_hubspot_id);
        associated = true;
      }

      await pool.query('UPDATE prospects SET hubspot_id = $1, updated_at = NOW() WHERE id = $2', [hsContact.id, c.id]);
      results.push({ id: c.id, name: c.name, hubspot_id: hsContact.id, associated });
    }

    res.json({ dry_run: false, synced: results.length, results });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
