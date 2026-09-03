const axios = require('axios');

const BASE_URL = 'https://api.apollo.io/api/v1';

function client() {
  return axios.create({
    baseURL: BASE_URL,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      'x-api-key': process.env.APOLLO_API_KEY,
    },
  });
}

// Up to 10 people per call. `matches` is positionally aligned with `details` --
// index i of the response corresponds to index i of the request, with `null` for a miss.
async function bulkMatch(details, { revealPhoneNumber = false, webhookUrl } = {}) {
  const body = { details };
  if (revealPhoneNumber) {
    body.reveal_phone_number = true;
    body.webhook_url = webhookUrl;
  }
  const { data } = await client().post('/people/bulk_match', body);
  return data;
}

async function enrichOrganization(domain) {
  const { data } = await client().get('/organizations/enrich', { params: { domain } });
  return data.organization;
}

module.exports = { bulkMatch, enrichOrganization };
