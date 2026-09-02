const { pool } = require('../db');
const clay = require('./clay');

const TITLE_KEYWORDS = [
  'GTM Engineer', 'Revenue Operations', 'Marketing Operations',
  'Growth Engineer', 'Growth Marketer', 'RevOps',
];

const DOMAIN_CHUNK_SIZE = 900; // clay.include_company_identifiers caps at 1000 entries

function chunk(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) chunks.push(array.slice(i, i + size));
  return chunks;
}

function escapeQueryString(value) {
  return String(value).replace(/"/g, '\\"');
}

// Re-checks every Tier 1/2 company for a currently-open GTM Engineer/RevOps/Marketing
// Ops job posting. This signal decays fast (a stale posting is filled or deprioritized
// within ~30 days), so this is meant to be re-run periodically, not once -- it always
// overwrites hiring_signal/tier from a fresh check rather than only ever adding matches,
// so a company whose posting disappeared gets demoted back out of Tier 2. Tier 3
// companies are left alone -- this signal doesn't apply to that segment.
async function refreshHiringSignals() {
  const { rows: companies } = await pool.query(
    `SELECT id, domain, tier FROM companies WHERE domain IS NOT NULL AND (tier IS NULL OR tier IN (1, 2))`
  );
  if (companies.length === 0) return { checked: 0, promoted: 0, demoted: 0 };

  const domainToTitles = new Map();

  for (const domainChunk of chunk(companies.map((c) => c.domain), DOMAIN_CHUNK_SIZE)) {
    const domainList = domainChunk.map((d) => `"${escapeQueryString(d)}"`).join(', ');

    for (const title of TITLE_KEYWORDS) {
      const query = `select from companies where clay.include_company_identifiers((${domainList})) and jobs.exists(job_still_open = true and job_title is_similar_to ("${escapeQueryString(title)}"))`;
      const { results } = await clay.searchAll(query, { pageSize: 100, maxResults: domainChunk.length });

      for (const match of results) {
        if (!match.domain) continue;
        const existing = domainToTitles.get(match.domain) || new Set();
        existing.add(title);
        domainToTitles.set(match.domain, existing);
      }
    }
  }

  let promoted = 0;
  let demoted = 0;

  for (const company of companies) {
    const matchedTitles = domainToTitles.get(company.domain);
    const hasSignal = Boolean(matchedTitles?.size);
    const newTier = company.tier === 3 ? 3 : (hasSignal ? 2 : 1);

    if (hasSignal && company.tier !== 2) promoted += 1;
    if (!hasSignal && company.tier === 2) demoted += 1;

    await pool.query(
      `UPDATE companies SET
         hiring_signal = $1,
         hiring_signal_titles = $2,
         tier = $3,
         hiring_signal_checked_at = NOW(),
         updated_at = NOW()
       WHERE id = $4`,
      [hasSignal, hasSignal ? [...matchedTitles].join(', ') : null, newTier, company.id]
    );
  }

  return { checked: companies.length, promoted, demoted };
}

module.exports = { refreshHiringSignals };
