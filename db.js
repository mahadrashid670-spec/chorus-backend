// db.js
// Uses better-sqlite3: a real file-based SQL database, zero external service
// needed to get started. Good enough for launch; swap the connection string
// for Postgres later if you outgrow it (schema below maps 1:1).

const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'chorus.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS businesses (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    biz_name TEXT NOT NULL DEFAULT 'My Business',
    slug TEXT UNIQUE NOT NULL,
    question TEXT NOT NULL DEFAULT 'How was your experience with us?',
    plan TEXT NOT NULL DEFAULT 'free',
    paddle_customer_id TEXT,
    paddle_subscription_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS testimonials (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    role TEXT,
    quote TEXT NOT NULL,
    rating INTEGER NOT NULL DEFAULT 5,
    approved INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_testimonials_business ON testimonials(business_id);
`);

module.exports = db;
