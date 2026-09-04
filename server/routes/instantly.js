const express = require('express');
const { pool } = require('../db');
const instantly = require('../services/instantly');
const router = express.Router();

async function getCampaignId() {
  const { rows } = await pool.query(`SELECT value FROM pipeline_state WHERE key = 'instantly_campaign_id'`);
  return rows[0]?.value || null;
}

router.get('/campaigns', async (req, res, next) => {
  try {
    const campaigns = await instantly.listCampaigns();
    res.json(campaigns);
  } catch (err) {
    next(err);
  }
});

// Sets which campaign contacts sync into -- stored in pipeline_state (not an env var)
// so it can be changed without a redeploy once a real campaign exists in Instantly.
router.post('/config', async (req, res, next) => {
  try {
    const { campaign_id } = req.body;
    if (!campaign_id) return res.status(400).json({ message: 'campaign_id is required.' });
    await pool.query(
      `INSERT INTO pipeline_state (key, value) VALUES ('instantly_campaign_id', $1)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [campaign_id]
    );
    res.json({ campaign_id });
  } catch (err) {
    next(err);
  }
});

// Pushes contacts with an email into the configured campaign, denormalizing company
// context (tier, score, hiring signal, etc.) into custom_variables since Instantly has
// no separate company object -- everything lives on the flat lead record.
router.post('/sync-contacts', async (req, res, next) => {
  try {
    const { limit = 20, dry_run = true } = req.body;

    const campaignId = await getCampaignId();
    if (!campaignId && !dry_run) {
      return res.status(400).json({ message: 'No Instantly campaign configured. POST /api/instantly/config with a campaign_id first.' });
    }

    const { rows: contacts } = await pool.query(
      `SELECT p.*, c.name AS company_name, c.website, c.tier, c.score, c.industry,
              c.hiring_signal, c.hiring_signal_titles, c.marketing_headcount, c.funding_stage
       FROM prospects p
       LEFT JOIN companies c ON c.id = p.company_id
       WHERE p.email IS NOT NULL AND p.instantly_id IS NULL
       ORDER BY p.id
       LIMIT $1`,
      [limit]
    );

    if (dry_run) {
      return res.json({
        dry_run: true,
        campaign_id: campaignId,
        would_sync: contacts.length,
        contacts: contacts.map((c) => ({ id: c.id, name: c.name, email: c.email, company: c.company_name })),
      });
    }

    const results = [];
    for (const c of contacts) {
      const [firstName, ...rest] = c.name.split(' ');
      const lead = {
        email: c.email,
        first_name: firstName,
        last_name: rest.join(' ') || undefined,
        company_name: c.company_name || undefined,
        website: c.website || undefined,
        custom_variables: {
          title: c.title || undefined,
          phone: c.phone || undefined,
          linkedin_url: c.linkedin_url || undefined,
          company_tier: c.tier ?? undefined,
          company_score: c.score ?? undefined,
          company_industry: c.industry || undefined,
          hiring_signal: c.hiring_signal ? c.hiring_signal_titles || 'true' : undefined,
          marketing_headcount: c.marketing_headcount ?? undefined,
          funding_stage: c.funding_stage || undefined,
        },
      };
      Object.keys(lead.custom_variables).forEach((k) => lead.custom_variables[k] === undefined && delete lead.custom_variables[k]);
      Object.keys(lead).forEach((k) => lead[k] === undefined && delete lead[k]);

      const created = await instantly.upsertLead(campaignId, lead);
      await pool.query('UPDATE prospects SET instantly_id = $1, updated_at = NOW() WHERE id = $2', [created.id, c.id]);
      results.push({ id: c.id, name: c.name, instantly_id: created.id });
    }

    res.json({ dry_run: false, campaign_id: campaignId, synced: results.length, results });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
