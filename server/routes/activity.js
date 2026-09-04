const express = require('express');
const { pool } = require('../db');
const router = express.Router();

// Raw feed, most recent first -- what the Logs page's activity table shows.
router.get('/', async (req, res, next) => {
  try {
    const { source, limit = 100 } = req.query;
    const conditions = [];
    const params = [];
    if (source) {
      params.push(source);
      conditions.push(`source = $${params.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(limit);
    const { rows } = await pool.query(
      `SELECT * FROM activity_log ${where} ORDER BY created_at DESC LIMIT $${params.length}`,
      params
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// Rolled-up totals per source/action, plus the latest Clay quota snapshot -- the
// "brief on how many + what it cost" view at the top of the Logs page. Computed in JS
// rather than SQL since cost is a heterogeneous JSONB shape per provider (Apollo reports
// a real per-event credits_consumed; Clay only reports a cumulative account-wide
// snapshot, which can't be summed across rows without double-counting).
router.get('/summary', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM activity_log ORDER BY created_at DESC LIMIT 1000');

    const bySourceAction = {};
    let latestClayQuota = null;

    for (const row of rows) {
      const key = `${row.source}:${row.action}`;
      if (!bySourceAction[key]) {
        bySourceAction[key] = { source: row.source, action: row.action, events: 0, total_count: 0, total_credits: 0, has_credits: false };
      }
      const bucket = bySourceAction[key];
      bucket.events += 1;
      bucket.total_count += row.count || 0;
      if (row.cost?.credits_consumed != null) {
        bucket.total_credits += row.cost.credits_consumed;
        bucket.has_credits = true;
      }
      if (row.source === 'clay' && row.cost?.quota_remaining != null && !latestClayQuota) {
        latestClayQuota = { quota_used_to_date: row.cost.quota_used_to_date, quota_remaining: row.cost.quota_remaining, as_of: row.created_at };
      }
    }

    res.json({
      breakdown: Object.values(bySourceAction),
      clay_quota: latestClayQuota,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
