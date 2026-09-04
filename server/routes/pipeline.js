const express = require('express');
const { pool } = require('../db');
const { runDailyPipeline } = require('../services/pipeline');
const router = express.Router();

// Triggers one pipeline cycle on demand -- the same one that runs automatically daily.
// Useful for testing without waiting for the schedule.
router.post('/run', async (req, res, next) => {
  try {
    const { new_companies_per_run = 10 } = req.body;
    const summary = await runDailyPipeline({ newCompaniesPerRun: new_companies_per_run });
    res.json(summary);
  } catch (err) {
    next(err);
  }
});

// Recent run history, most recent first -- what the dashboard's Pipeline page shows.
router.get('/runs', async (req, res, next) => {
  try {
    const { limit = 20 } = req.query;
    const { rows } = await pool.query(
      'SELECT * FROM pipeline_runs ORDER BY started_at DESC LIMIT $1',
      [limit]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
