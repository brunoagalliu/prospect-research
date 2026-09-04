const { pool } = require('../db');

// Records one import/enrichment/sync event. `cost` captures whatever the provider
// actually reports (Clay's period_quota, Apollo's credits_consumed) -- providers that
// don't report a cost (HubSpot, Instantly, Apollo's org-enrich endpoint) just get null,
// never a fabricated number.
async function logActivity({ source, action, count = null, cost = null, detail = null }) {
  await pool.query(
    `INSERT INTO activity_log (source, action, count, cost, detail) VALUES ($1, $2, $3, $4, $5)`,
    [source, action, count, cost ? JSON.stringify(cost) : null, detail ? JSON.stringify(detail) : null]
  );
}

module.exports = { logActivity };
