const express = require('express');
const { pool } = require('../db');
const router = express.Router();

router.get('/', async (req, res) => {
  const { status, q, company_id } = req.query;
  const conditions = [];
  const params = [];

  if (status) {
    params.push(status);
    conditions.push(`p.status = $${params.length}`);
  }
  if (company_id) {
    params.push(company_id);
    conditions.push(`p.company_id = $${params.length}`);
  }
  if (q) {
    params.push(`%${q}%`);
    conditions.push(`(p.name ILIKE $${params.length} OR p.company ILIKE $${params.length})`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `SELECT p.*, c.tier AS company_tier, c.hiring_signal, c.hiring_signal_titles
     FROM prospects p
     LEFT JOIN companies c ON c.id = p.company_id
     ${where}
     ORDER BY p.created_at DESC`,
    params
  );
  res.json(rows);
});

router.get('/:id', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM prospects WHERE id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ message: 'Not found.' });
  res.json(rows[0]);
});

router.post('/', async (req, res) => {
  const { name, company, company_id, title, email, phone, linkedin_url, source, status, notes } = req.body;
  if (!name) return res.status(400).json({ message: 'name is required.' });

  const { rows } = await pool.query(
    `INSERT INTO prospects (name, company, company_id, title, email, phone, linkedin_url, source, status, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9, 'new'), $10)
     RETURNING *`,
    [name, company, company_id, title, email, phone, linkedin_url, source, status, notes]
  );
  res.status(201).json(rows[0]);
});

router.put('/:id', async (req, res) => {
  const { name, company, company_id, title, email, phone, linkedin_url, source, status, notes } = req.body;
  const { rows } = await pool.query(
    `UPDATE prospects SET
       name = COALESCE($1, name),
       company = $2,
       company_id = $3,
       title = $4,
       email = $5,
       phone = $6,
       linkedin_url = $7,
       source = $8,
       status = COALESCE($9, status),
       notes = $10,
       updated_at = NOW()
     WHERE id = $11
     RETURNING *`,
    [name, company, company_id, title, email, phone, linkedin_url, source, status, notes, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ message: 'Not found.' });
  res.json(rows[0]);
});

router.delete('/:id', async (req, res) => {
  const { rowCount } = await pool.query('DELETE FROM prospects WHERE id = $1', [req.params.id]);
  if (!rowCount) return res.status(404).json({ message: 'Not found.' });
  res.status(204).end();
});

module.exports = router;
