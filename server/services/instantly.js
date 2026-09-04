const axios = require('axios');

const BASE_URL = 'https://api.instantly.ai/api/v2';

function client() {
  return axios.create({
    baseURL: BASE_URL,
    headers: {
      Authorization: `Bearer ${process.env.INSTANTLY_API_KEY}`,
      'Content-Type': 'application/json',
    },
  });
}

async function listCampaigns() {
  const { data } = await client().get('/campaigns');
  return data.items;
}

// skip_if_in_campaign makes this safe to call repeatedly for the same email+campaign --
// verified live it returns the existing lead unchanged rather than duplicating or erroring.
async function upsertLead(campaignId, lead) {
  const { data } = await client().post('/leads', {
    campaign: campaignId,
    skip_if_in_campaign: true,
    ...lead,
  });
  return data;
}

module.exports = { listCampaigns, upsertLead };
