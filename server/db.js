const { Pool } = require('pg');

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
  `);
}

module.exports = { pool, init };
