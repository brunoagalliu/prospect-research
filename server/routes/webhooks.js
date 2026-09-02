const express = require('express');
const { pool } = require('../db');
const router = express.Router();

// Clay "Send to Webhook" enrichment step posts one prospect per request.
// Upserts on email so re-running a Clay table doesn't create duplicates.
router.post('/clay', async (req, res) => {
  const { name, company, title, email, linkedin_url, source, status, notes } = req.body;
  if (!name) return res.status(400).json({ message: 'name is required.' });

  const normalizedEmail = email ? String(email).trim().toLowerCase() : null;

  const { rows } = await pool.query(
    `INSERT INTO prospects (name, company, title, email, linkedin_url, source, status, notes)
     VALUES ($1, $2, $3, $4, $5, COALESCE($6, 'Clay'), COALESCE($7, 'new'), $8)
     ON CONFLICT (email) WHERE email IS NOT NULL DO UPDATE SET
       name         = EXCLUDED.name,
       company      = EXCLUDED.company,
       title        = EXCLUDED.title,
       linkedin_url = EXCLUDED.linkedin_url,
       source       = EXCLUDED.source,
       notes        = EXCLUDED.notes,
       updated_at   = NOW()
     RETURNING *`,
    [name, company, title, normalizedEmail, linkedin_url, source, status, notes]
  );
  res.status(201).json(rows[0]);
});

module.exports = router;
