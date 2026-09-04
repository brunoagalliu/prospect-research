const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS companies (
      id                    SERIAL PRIMARY KEY,
      name                  TEXT NOT NULL,
      domain                TEXT,
      website               TEXT,
      linkedin_url          TEXT,
      industry              TEXT,
      location              TEXT,
      employee_count        INTEGER,
      headcount_growth_pct  NUMERIC,
      funding_stage         TEXT,
      total_raised          NUMERIC,
      marketing_headcount   INTEGER,
      has_ops_hire          BOOLEAN NOT NULL DEFAULT false,
      ops_hire_titles       TEXT,
      hiring_signal         BOOLEAN NOT NULL DEFAULT false,
      hiring_signal_titles  TEXT,
      tech_stack            TEXT[],
      qualitative_notes     TEXT,
      tier                  SMALLINT CHECK (tier IN (1, 2, 3)),
      score                 SMALLINT CHECK (score BETWEEN 0 AND 100),
      source                TEXT,
      status                TEXT NOT NULL DEFAULT 'new',
      notes                 TEXT,
      created_at            TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at            TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS companies_tier   ON companies(tier);
    CREATE INDEX IF NOT EXISTS companies_score  ON companies(score);
    CREATE INDEX IF NOT EXISTS companies_status ON companies(status);

    -- Lets webhook imports (e.g. Clay) upsert by domain instead of creating duplicates.
    CREATE UNIQUE INDEX IF NOT EXISTS companies_domain_unique ON companies(domain) WHERE domain IS NOT NULL;

    -- Hiring-signal job postings decay fast (a posting >30 days old is likely stale) --
    -- this tracks when we last actually checked, since hiring_signal alone can't say.
    ALTER TABLE companies ADD COLUMN IF NOT EXISTS hiring_signal_checked_at TIMESTAMP;
    -- Tracks the synced HubSpot record so re-syncing updates in place instead of
    -- relying solely on the domain search (domain isn't a unique property in HubSpot).
    ALTER TABLE companies ADD COLUMN IF NOT EXISTS hubspot_id TEXT;

    CREATE TABLE IF NOT EXISTS prospects (
      id           SERIAL PRIMARY KEY,
      name         TEXT NOT NULL,
      company      TEXT,
      title        TEXT,
      email        TEXT,
      linkedin_url TEXT,
      source       TEXT,
      status       TEXT NOT NULL DEFAULT 'new',
      notes        TEXT,
      created_at   TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at   TIMESTAMP NOT NULL DEFAULT NOW()
    );

    -- Added after the initial launch — existing deployments need these backfilled onto the table.
    ALTER TABLE prospects ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL;
    ALTER TABLE prospects ADD COLUMN IF NOT EXISTS phone TEXT;
    -- Correlates Apollo's async phone-reveal webhook callback back to the right row.
    ALTER TABLE prospects ADD COLUMN IF NOT EXISTS apollo_person_id TEXT;
    ALTER TABLE prospects ADD COLUMN IF NOT EXISTS hubspot_id TEXT;
    -- Tracks the synced Instantly lead so re-syncing is idempotent (paired with
    -- skip_if_in_campaign on the Instantly side as a second safety net).
    ALTER TABLE prospects ADD COLUMN IF NOT EXISTS instantly_id TEXT;

    CREATE INDEX IF NOT EXISTS prospects_status           ON prospects(status);
    CREATE INDEX IF NOT EXISTS prospects_company          ON prospects(company);
    CREATE INDEX IF NOT EXISTS prospects_company_id       ON prospects(company_id);
    CREATE INDEX IF NOT EXISTS prospects_apollo_person_id ON prospects(apollo_person_id);

    -- Lets webhook imports (e.g. Clay) upsert by email instead of creating duplicates.
    CREATE UNIQUE INDEX IF NOT EXISTS prospects_email_unique ON prospects(email) WHERE email IS NOT NULL;

    -- Small key-value store for pipeline automation state (e.g. the Clay search_id
    -- being paged through for daily sourcing, so we advance through fresh results
    -- instead of re-fetching the same companies or embedding a growing exclusion list).
    CREATE TABLE IF NOT EXISTS pipeline_state (
      key   TEXT PRIMARY KEY,
      value TEXT
    );

    -- Real accounts, replacing the old single-shared-password login.
    CREATE TABLE IF NOT EXISTS users (
      id            SERIAL PRIMARY KEY,
      email         TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at    TIMESTAMP NOT NULL DEFAULT NOW()
    );

    -- One row per pipeline cycle (scheduled or manually triggered via POST
    -- /api/pipeline/run), so runs are visible in the dashboard instead of only in
    -- Railway's server logs.
    CREATE TABLE IF NOT EXISTS pipeline_runs (
      id          SERIAL PRIMARY KEY,
      started_at  TIMESTAMP NOT NULL,
      finished_at TIMESTAMP,
      summary     JSONB,
      error       TEXT
    );
    CREATE INDEX IF NOT EXISTS pipeline_runs_started_at ON pipeline_runs(started_at DESC);

    -- One row per import/enrichment/sync event (Clay search, Apollo enrichment, HubSpot
    -- or Instantly sync, and eventually proposal-page generation) -- more granular than
    -- pipeline_runs, built specifically to answer "how many, and what did it cost."
    -- cost is null when the provider doesn't report one (HubSpot/Instantly have no
    -- credit concept; Apollo's org-enrich endpoint doesn't return a cost) -- never
    -- fabricated.
    CREATE TABLE IF NOT EXISTS activity_log (
      id         SERIAL PRIMARY KEY,
      source     TEXT NOT NULL,
      action     TEXT NOT NULL,
      count      INTEGER,
      cost       JSONB,
      detail     JSONB,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS activity_log_created_at ON activity_log(created_at DESC);
    CREATE INDEX IF NOT EXISTS activity_log_source     ON activity_log(source);
  `);

  // One-time bootstrap: if no accounts exist yet and ADMIN_EMAIL/ADMIN_PASSWORD are set,
  // create the first (and typically only) account. Safe to leave the env vars set
  // permanently -- this only ever fires while the users table is empty.
  const { rows: existing } = await pool.query('SELECT COUNT(*)::int AS count FROM users');
  if (existing[0].count === 0 && process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
    const passwordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);
    await pool.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) ON CONFLICT (email) DO NOTHING',
      [process.env.ADMIN_EMAIL.toLowerCase(), passwordHash]
    );
    console.log(`Bootstrapped admin account for ${process.env.ADMIN_EMAIL}`);
  }
}

module.exports = { pool, init };
