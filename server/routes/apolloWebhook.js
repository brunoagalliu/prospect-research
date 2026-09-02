const express = require('express');
const { pool } = require('../db');
const router = express.Router();

// Apollo's phone-reveal callback: a plain POST with no auth headers and no signature
// verification (per Apollo's docs), so a shared-secret token in the URL query string
// is what stands in for auth here. Mounted OUTSIDE /api in index.js so it isn't blocked
// by the normal X-API-Key/JWT gate, which Apollo has no way to satisfy.
router.post('/apollo-phone', async (req, res, next) => {
  try {
    if (req.query.token !== process.env.APOLLO_WEBHOOK_SECRET) {
      return res.status(401).json({ message: 'Invalid token.' });
    }

    const people = req.body.people || [];
    let updated = 0;

    for (const person of people) {
      if (person.status !== 'success' || !person.phone_numbers?.length) continue;
      const best = person.phone_numbers.find((p) => p.status === 'valid_number') || person.phone_numbers[0];
      const { rowCount } = await pool.query(
        `UPDATE prospects SET phone = $1, updated_at = NOW() WHERE apollo_person_id = $2`,
        [best.sanitized_number || best.raw_number, person.id]
      );
      updated += rowCount;
    }

    res.json({ received: people.length, updated });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
