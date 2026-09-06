-- D1 schema for AI Cloud Platform
-- Run: wrangler d1 execute ai-cloud-platform --file=./schema.sql

CREATE TABLE IF NOT EXISTS sub_keys (
  id TEXT PRIMARY KEY,
  key_hash TEXT NOT NULL UNIQUE,
  user_ip TEXT,
  created_at INTEGER NOT NULL,
  calls_daily INTEGER DEFAULT 0,
  tokens_daily INTEGER DEFAULT 0,
  calls_limit INTEGER DEFAULT 100,
  tokens_limit INTEGER DEFAULT 100000,
  last_reset_date TEXT,
  disabled INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS call_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sub_key_id TEXT,
  model TEXT,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  total_tokens INTEGER,
  latency_ms INTEGER,
  error TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_logs_date ON call_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_logs_subkey ON call_logs(sub_key_id);
CREATE INDEX IF NOT EXISTS idx_logs_model ON call_logs(model);
