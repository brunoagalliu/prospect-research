const express = require('express');
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

module.exports = router;
