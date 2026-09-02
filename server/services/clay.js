const axios = require('axios');

const BASE_URL = 'https://api.clay.com/public/v0';

function client() {
  return axios.create({
    baseURL: BASE_URL,
    headers: {
      'Content-Type': 'application/json',
      'clay-api-key': process.env.CLAY_API_KEY,
    },
  });
}

// Returns the live query grammar + field catalog as markdown. Not filterable itself,
// but needed to know which fields/operators are currently valid.
async function getQueryReference() {
  const { data } = await client().get('/search/query-mode/reference');
  return data.reference;
}

async function createSearch(query) {
  const { data } = await client().post('/search/query-mode', { query });
  return data; // { search_id, source_type }
}

async function runSearch(searchId, limit = 100) {
  const { data } = await client().post(`/search/query-mode/${searchId}/run`, { limit });
  return data; // { data, has_more, source_type, exhaustion_reason, period_quota }
}

// Pages through a query-mode search until has_more is false or maxResults is hit.
// Clay's iterator can return an empty page with has_more still true (results not
// ready yet) -- tolerate a few of those before concluding the search is exhausted,
// so we don't give up on real results, but cap it so a genuinely-empty search
// doesn't spin forever burning quota.
async function searchAll(query, { pageSize = 100, maxResults = 100, maxEmptyPages = 4 } = {}) {
  const { search_id: searchId } = await createSearch(query);
  const results = [];
  let hasMore = true;
  let periodQuota = null;
  let consecutiveEmptyPages = 0;

  while (hasMore && results.length < maxResults && consecutiveEmptyPages < maxEmptyPages) {
    const remaining = maxResults - results.length;
    const page = await runSearch(searchId, Math.min(pageSize, remaining));
    periodQuota = page.period_quota;
    hasMore = page.has_more;

    if (page.data.length === 0) {
      consecutiveEmptyPages += 1;
      continue;
    }
    consecutiveEmptyPages = 0;
    results.push(...page.data);
  }

  return { results, periodQuota };
}

module.exports = { getQueryReference, createSearch, runSearch, searchAll };
