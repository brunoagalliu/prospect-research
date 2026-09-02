const express = require('express');
const { pool } = require('../db');
const router = express.Router();

router.get('/', async (req, res) => {
  const { status, q } = req.query;
  const conditions = [];
  const params = [];

  if (status) {
    params.push(status);
    conditions.push(`status = $${params.length}`);
  }
  if (q) {
    params.push(`%${q}%`);
    conditions.push(`(name ILIKE $${params.length} OR company ILIKE $${params.length})`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `SELECT * FROM prospects ${where} ORDER BY created_at DESC`,
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
  const { name, company, title, email, linkedin_url, source, status, notes } = req.body;
  if (!name) return res.status(400).json({ message: 'name is required.' });

  const { rows } = await pool.query(
    `INSERT INTO prospects (name, company, title, email, linkedin_url, source, status, notes)
     VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, 'new'), $8)
     RETURNING *`,
    [name, company, title, email, linkedin_url, source, status, notes]
  );
  res.status(201).json(rows[0]);
});

router.put('/:id', async (req, res) => {
  const { name, company, title, email, linkedin_url, source, status, notes } = req.body;
  const { rows } = await pool.query(
    `UPDATE prospects SET
       name = COALESCE($1, name),
       company = $2,
       title = $3,
       email = $4,
       linkedin_url = $5,
       source = $6,
       status = COALESCE($7, status),
       notes = $8,
       updated_at = NOW()
     WHERE id = $9
     RETURNING *`,
    [name, company, title, email, linkedin_url, source, status, notes, req.params.id]
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
