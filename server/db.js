const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function init() {
  await pool.query(`
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

    CREATE INDEX IF NOT EXISTS prospects_status  ON prospects(status);
    CREATE INDEX IF NOT EXISTS prospects_company ON prospects(company);

    -- Lets webhook imports (e.g. Clay) upsert by email instead of creating duplicates.
    CREATE UNIQUE INDEX IF NOT EXISTS prospects_email_unique ON prospects(email) WHERE email IS NOT NULL;
  `);
}

module.exports = { pool, init };
