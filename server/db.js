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
  `);
}

module.exports = { pool, init };
