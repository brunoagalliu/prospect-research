const express = require('express');
const { pool } = require('../db');
const apollo = require('../services/apollo');
const router = express.Router();

const BATCH_SIZE = 10; // Apollo bulk_match's per-request cap

// Looks up work email (and backfills linkedin_url) for prospects that have a linked
// company with a known domain but no email yet. Costs Apollo credits per real match
// (misses are free) -- default dry_run previews without spending credits or writing.
router.post('/enrich-contacts', async (req, res, next) => {
  try {
    const { limit = 20, dry_run = true } = req.body;

    const { rows: contacts } = await pool.query(
      `SELECT p.id, p.name, p.title, p.company_id, c.domain
       FROM prospects p
       JOIN companies c ON c.id = p.company_id
       WHERE p.email IS NULL AND c.domain IS NOT NULL
       ORDER BY p.id
       LIMIT $1`,
      [limit]
    );

    const results = [];
    let creditsConsumed = 0;

    for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
      const batch = contacts.slice(i, i + BATCH_SIZE);
      const details = batch.map((c) => ({ name: c.name, domain: c.domain }));
      const response = await apollo.bulkMatch(details);
      creditsConsumed += response.credits_consumed || 0;

      batch.forEach((contact, idx) => {
        const match = response.matches[idx];
        results.push({
          id: contact.id,
          name: contact.name,
          company_id: contact.company_id,
          matched: Boolean(match?.email),
          email: match?.email || null,
          email_status: match?.email_status || null,
          linkedin_url: match?.linkedin_url || null,
          apollo_person_id: match?.id || null,
        });
      });
    }

    if (dry_run) {
      const matchedCount = results.filter((r) => r.matched).length;
      return res.json({ dry_run: true, checked: contacts.length, matched: matchedCount, credits_would_consume: creditsConsumed, results });
    }

    let updated = 0;
    for (const result of results) {
      if (!result.matched) continue;
      await pool.query(
        `UPDATE prospects SET email = $1, linkedin_url = COALESCE(linkedin_url, $2), apollo_person_id = COALESCE($3, apollo_person_id), updated_at = NOW() WHERE id = $4`,
        [result.email, result.linkedin_url, result.apollo_person_id, result.id]
      );
      updated += 1;
    }

    res.json({ dry_run: false, checked: contacts.length, matched: updated, credits_consumed: creditsConsumed, results });
  } catch (err) {
    next(err);
  }
});

// Requests phone numbers for prospects with a linked company but no phone yet.
// Apollo delivers phone numbers ASYNCHRONOUSLY to a webhook (see /webhooks/apollo-phone
// in index.js) -- this route just kicks off the request and records apollo_person_id
// so the webhook callback can find the right row later. dry_run makes no Apollo call
// at all (unlike enrich-contacts) since a real phone request costs credits up front,
// before any result is known.
router.post('/enrich-phones', async (req, res, next) => {
  try {
    const { limit = 20, dry_run = true } = req.body;

    const { rows: contacts } = await pool.query(
      `SELECT p.id, p.name, p.company_id, c.domain
       FROM prospects p
       JOIN companies c ON c.id = p.company_id
       WHERE p.phone IS NULL AND c.domain IS NOT NULL
       ORDER BY p.id
       LIMIT $1`,
      [limit]
    );

    if (dry_run) {
      return res.json({ dry_run: true, would_request: contacts.length, contacts: contacts.map((c) => ({ id: c.id, name: c.name, company_id: c.company_id })) });
    }

    if (!process.env.APOLLO_WEBHOOK_SECRET) {
      return res.status(500).json({ message: 'APOLLO_WEBHOOK_SECRET is not set.' });
    }
    if (!process.env.RAILWAY_PUBLIC_DOMAIN) {
      return res.status(500).json({ message: 'RAILWAY_PUBLIC_DOMAIN is not set -- cannot build a public webhook URL.' });
    }
    const webhookUrl = `https://${process.env.RAILWAY_PUBLIC_DOMAIN}/webhooks/apollo-phone?token=${process.env.APOLLO_WEBHOOK_SECRET}`;

    let requested = 0;
    let creditsConsumed = 0;

    for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
      const batch = contacts.slice(i, i + BATCH_SIZE);
      const details = batch.map((c) => ({ name: c.name, domain: c.domain }));
      const response = await apollo.bulkMatch(details, { revealPhoneNumber: true, webhookUrl });
      creditsConsumed += response.credits_consumed || 0;

      for (let idx = 0; idx < batch.length; idx += 1) {
        const match = response.matches[idx];
        if (!match?.id) continue;
        await pool.query(
          `UPDATE prospects SET apollo_person_id = $1, updated_at = NOW() WHERE id = $2`,
          [match.id, batch[idx].id]
        );
        requested += 1;
      }
    }

    res.json({ dry_run: false, checked: contacts.length, requested, credits_consumed: creditsConsumed, note: 'Phone numbers arrive asynchronously via webhook -- check back shortly.' });
  } catch (err) {
    next(err);
  }
});

// Backfills employee count, funding, and headcount growth for companies sourced via
// Clay search -- Clay's search results never included these as output fields (they're
// filter-only there), so this is the only source we have for the actual numbers.
router.post('/enrich-companies', async (req, res, next) => {
  try {
    const { limit = 20, dry_run = true } = req.body;

    const { rows: companies } = await pool.query(
      `SELECT id, name, domain FROM companies
       WHERE domain IS NOT NULL AND employee_count IS NULL
       ORDER BY id
       LIMIT $1`,
      [limit]
    );

    const results = [];
    for (const company of companies) {
      let org;
      try {
        org = await apollo.enrichOrganization(company.domain);
      } catch (err) {
        results.push({ id: company.id, name: company.name, matched: false, error: err.response?.data?.message || err.message });
        continue;
      }
      if (!org) {
        results.push({ id: company.id, name: company.name, matched: false });
        continue;
      }

      const latestFundingEvent = org.funding_events?.[0]; // most recent first, per Apollo's ordering
      const growthRatio = org.organization_headcount_twelve_month_growth;

      results.push({
        id: company.id,
        name: company.name,
        matched: true,
        employee_count: org.estimated_num_employees ?? null,
        headcount_growth_pct: growthRatio != null ? Math.round(growthRatio * 1000) / 10 : null,
        funding_stage: latestFundingEvent?.type || org.latest_funding_stage || null,
        total_raised: org.total_funding ?? null,
        tech_stack: org.current_technologies?.length
          ? [...new Set(org.current_technologies.map((t) => t.name))].slice(0, 30)
          : null,
      });
    }

    if (dry_run) {
      const matchedCount = results.filter((r) => r.matched).length;
      return res.json({ dry_run: true, checked: companies.length, matched: matchedCount, results });
    }

    let updated = 0;
    for (const result of results) {
      if (!result.matched) continue;
      await pool.query(
        `UPDATE companies SET
           employee_count = COALESCE($1, employee_count),
           headcount_growth_pct = COALESCE($2, headcount_growth_pct),
           funding_stage = COALESCE($3, funding_stage),
           total_raised = COALESCE($4, total_raised),
           tech_stack = COALESCE($5, tech_stack),
           updated_at = NOW()
         WHERE id = $6`,
        [result.employee_count, result.headcount_growth_pct, result.funding_stage, result.total_raised, result.tech_stack, result.id]
      );
      updated += 1;
    }

    res.json({ dry_run: false, checked: companies.length, matched: updated, results });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
