const express = require('express');
const { pool } = require('../db');
const router = express.Router();

// Clay "Find Companies" / scoring pipeline posts one qualified company per request.
// Upserts on domain so re-running a Clay table doesn't create duplicates.
router.post('/clay/companies', async (req, res) => {
  const {
    name, domain, website, linkedin_url, industry, location, employee_count,
    headcount_growth_pct, funding_stage, total_raised, marketing_headcount,
    has_ops_hire, ops_hire_titles, hiring_signal, hiring_signal_titles,
    tech_stack, qualitative_notes, tier, score, source, status, notes,
  } = req.body;
  if (!name) return res.status(400).json({ message: 'name is required.' });

  const normalizedDomain = domain ? String(domain).trim().toLowerCase() : null;

  const { rows } = await pool.query(
    `INSERT INTO companies (
       name, domain, website, linkedin_url, industry, location, employee_count,
       headcount_growth_pct, funding_stage, total_raised, marketing_headcount,
       has_ops_hire, ops_hire_titles, hiring_signal, hiring_signal_titles,
       tech_stack, qualitative_notes, tier, score, source, status, notes
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,COALESCE($12,false),$13,COALESCE($14,false),$15,$16,$17,$18,$19,COALESCE($20,'Clay'),COALESCE($21,'new'),$22)
     ON CONFLICT (domain) WHERE domain IS NOT NULL DO UPDATE SET
       name                 = EXCLUDED.name,
       website              = EXCLUDED.website,
       linkedin_url         = EXCLUDED.linkedin_url,
       industry             = EXCLUDED.industry,
       location             = EXCLUDED.location,
       employee_count       = EXCLUDED.employee_count,
       headcount_growth_pct = EXCLUDED.headcount_growth_pct,
       funding_stage        = EXCLUDED.funding_stage,
       total_raised         = EXCLUDED.total_raised,
       marketing_headcount  = EXCLUDED.marketing_headcount,
       has_ops_hire         = EXCLUDED.has_ops_hire,
       ops_hire_titles      = EXCLUDED.ops_hire_titles,
       hiring_signal        = EXCLUDED.hiring_signal,
       hiring_signal_titles = EXCLUDED.hiring_signal_titles,
       tech_stack           = EXCLUDED.tech_stack,
       qualitative_notes    = EXCLUDED.qualitative_notes,
       tier                 = EXCLUDED.tier,
       score                = EXCLUDED.score,
       notes                = EXCLUDED.notes,
       updated_at           = NOW()
     RETURNING *`,
    [name, normalizedDomain, website, linkedin_url, industry, location, employee_count,
     headcount_growth_pct, funding_stage, total_raised, marketing_headcount,
     has_ops_hire, ops_hire_titles, hiring_signal, hiring_signal_titles,
     tech_stack, qualitative_notes, tier, score, source, status, notes]
  );
  res.status(201).json(rows[0]);
});

// Clay "Send to Webhook" enrichment step posts one prospect per request.
// Upserts on email so re-running a Clay table doesn't create duplicates.
// If company_domain is given, links the contact to the matching company row.
router.post('/clay', async (req, res) => {
  const { name, company, company_domain, title, email, phone, linkedin_url, source, status, notes } = req.body;
  if (!name) return res.status(400).json({ message: 'name is required.' });

  const normalizedEmail = email ? String(email).trim().toLowerCase() : null;

  let companyId = null;
  if (company_domain) {
    const normalizedDomain = String(company_domain).trim().toLowerCase();
    const { rows: companyRows } = await pool.query('SELECT id FROM companies WHERE domain = $1', [normalizedDomain]);
    companyId = companyRows[0]?.id || null;
  }

  const { rows } = await pool.query(
    `INSERT INTO prospects (name, company, company_id, title, email, phone, linkedin_url, source, status, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, 'Clay'), COALESCE($9, 'new'), $10)
     ON CONFLICT (email) WHERE email IS NOT NULL DO UPDATE SET
       name         = EXCLUDED.name,
       company      = EXCLUDED.company,
       company_id   = COALESCE(EXCLUDED.company_id, prospects.company_id),
       title        = EXCLUDED.title,
       phone        = EXCLUDED.phone,
       linkedin_url = EXCLUDED.linkedin_url,
       source       = EXCLUDED.source,
       notes        = EXCLUDED.notes,
       updated_at   = NOW()
     RETURNING *`,
    [name, company, companyId, title, normalizedEmail, phone, linkedin_url, source, status, notes]
  );
  res.status(201).json(rows[0]);
});

module.exports = router;
