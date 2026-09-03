const express = require('express');
const { pool } = require('../db');
const { computeScore } = require('../services/scoring');
const router = express.Router();

router.get('/', async (req, res) => {
  const { status, tier, min_score, q } = req.query;
  const conditions = [];
  const params = [];

  if (status) {
    params.push(status);
    conditions.push(`status = $${params.length}`);
  }
  if (tier) {
    params.push(tier);
    conditions.push(`tier = $${params.length}`);
  }
  if (min_score) {
    params.push(min_score);
    conditions.push(`score >= $${params.length}`);
  }
  if (q) {
    params.push(`%${q}%`);
    conditions.push(`(name ILIKE $${params.length} OR domain ILIKE $${params.length})`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `SELECT * FROM companies ${where} ORDER BY score DESC NULLS LAST, created_at DESC`,
    params
  );
  res.json(rows);
});

router.get('/:id', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM companies WHERE id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ message: 'Not found.' });

  const contacts = await pool.query('SELECT * FROM prospects WHERE company_id = $1 ORDER BY created_at DESC', [req.params.id]);
  res.json({ ...rows[0], contacts: contacts.rows });
});

router.post('/', async (req, res) => {
  const {
    name, domain, website, linkedin_url, industry, location, employee_count,
    headcount_growth_pct, funding_stage, total_raised, marketing_headcount,
    has_ops_hire, ops_hire_titles, hiring_signal, hiring_signal_titles,
    tech_stack, qualitative_notes, tier, score, source, status, notes,
  } = req.body;
  if (!name) return res.status(400).json({ message: 'name is required.' });

  const { rows } = await pool.query(
    `INSERT INTO companies (
       name, domain, website, linkedin_url, industry, location, employee_count,
       headcount_growth_pct, funding_stage, total_raised, marketing_headcount,
       has_ops_hire, ops_hire_titles, hiring_signal, hiring_signal_titles,
       tech_stack, qualitative_notes, tier, score, source, status, notes
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,COALESCE($12,false),$13,COALESCE($14,false),$15,$16,$17,$18,$19,$20,COALESCE($21,'new'),$22)
     RETURNING *`,
    [name, domain, website, linkedin_url, industry, location, employee_count,
     headcount_growth_pct, funding_stage, total_raised, marketing_headcount,
     has_ops_hire, ops_hire_titles, hiring_signal, hiring_signal_titles,
     tech_stack, qualitative_notes, tier, score, source, status, notes]
  );
  res.status(201).json(rows[0]);
});

router.put('/:id', async (req, res) => {
  const {
    name, domain, website, linkedin_url, industry, location, employee_count,
    headcount_growth_pct, funding_stage, total_raised, marketing_headcount,
    has_ops_hire, ops_hire_titles, hiring_signal, hiring_signal_titles,
    tech_stack, qualitative_notes, tier, score, source, status, notes,
  } = req.body;

  const { rows } = await pool.query(
    `UPDATE companies SET
       name                 = COALESCE($1, name),
       domain               = $2,
       website              = $3,
       linkedin_url         = $4,
       industry             = $5,
       location             = $6,
       employee_count       = $7,
       headcount_growth_pct = $8,
       funding_stage        = $9,
       total_raised         = $10,
       marketing_headcount  = $11,
       has_ops_hire         = COALESCE($12, has_ops_hire),
       ops_hire_titles      = $13,
       hiring_signal        = COALESCE($14, hiring_signal),
       hiring_signal_titles = $15,
       tech_stack           = $16,
       qualitative_notes    = $17,
       tier                 = $18,
       score                = $19,
       source               = $20,
       status               = COALESCE($21, status),
       notes                = $22,
       updated_at           = NOW()
     WHERE id = $23
     RETURNING *`,
    [name, domain, website, linkedin_url, industry, location, employee_count,
     headcount_growth_pct, funding_stage, total_raised, marketing_headcount,
     has_ops_hire, ops_hire_titles, hiring_signal, hiring_signal_titles,
     tech_stack, qualitative_notes, tier, score, source, status, notes, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ message: 'Not found.' });
  res.json(rows[0]);
});

// Recomputes score for every company from currently-stored data -- pure computation,
// no external API calls, so it's cheap to re-run any time the formula or underlying
// data changes. dry_run previews the distribution without writing.
router.post('/recompute-scores', async (req, res, next) => {
  try {
    const { dry_run = true } = req.body;
    const { rows: companies } = await pool.query('SELECT * FROM companies');

    const results = companies.map((c) => ({ id: c.id, name: c.name, tier: c.tier, score: computeScore(c) }));

    if (dry_run) {
      const sorted = [...results].sort((a, b) => b.score - a.score);
      return res.json({ dry_run: true, checked: results.length, top: sorted.slice(0, 10), bottom: sorted.slice(-10) });
    }

    for (const r of results) {
      await pool.query('UPDATE companies SET score = $1, updated_at = NOW() WHERE id = $2', [r.score, r.id]);
    }
    res.json({ dry_run: false, updated: results.length });
  } catch (err) {
    next(err);
  }
});

// Bulk-tags tier only, leaving every other column untouched -- unlike PUT /:id, which
// requires the full field set since only a few columns are COALESCE-protected there.
router.post('/bulk-tier', async (req, res, next) => {
  try {
    const { ids, tier } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ message: 'ids must be a non-empty array.' });
    if (![1, 2, 3].includes(tier)) return res.status(400).json({ message: 'tier must be 1, 2, or 3.' });

    const { rowCount } = await pool.query(
      `UPDATE companies SET tier = $1, updated_at = NOW() WHERE id = ANY($2)`,
      [tier, ids]
    );
    res.json({ updated: rowCount });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res) => {
  const { rowCount } = await pool.query('DELETE FROM companies WHERE id = $1', [req.params.id]);
  if (!rowCount) return res.status(404).json({ message: 'Not found.' });
  res.status(204).end();
});

module.exports = router;
