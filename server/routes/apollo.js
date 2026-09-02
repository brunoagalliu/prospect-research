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
        `UPDATE prospects SET email = $1, linkedin_url = COALESCE(linkedin_url, $2), updated_at = NOW() WHERE id = $3`,
        [result.email, result.linkedin_url, result.id]
      );
      updated += 1;
    }

    res.json({ dry_run: false, checked: contacts.length, matched: updated, credits_consumed: creditsConsumed, results });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
