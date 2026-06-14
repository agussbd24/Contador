-- Cloudflare D1 Schema for Solana Quant Platform

CREATE TABLE IF NOT EXISTS signals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  time TEXT NOT NULL,
  symbol TEXT NOT NULL DEFAULT 'SOLUSDT',
  signal TEXT NOT NULL,
  confidence INTEGER NOT NULL,
  composite_score REAL,
  technical_score REAL,
  onchain_score REAL,
  sentiment_score REAL,
  price REAL,
  stop_loss REAL,
  take_profit REAL,
  rr_ratio REAL,
  outcome TEXT DEFAULT 'PENDING',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_signals_time ON signals (time DESC);
CREATE INDEX IF NOT EXISTS idx_signals_signal ON signals (signal);

CREATE TABLE IF NOT EXISTS fear_greed_history (
  time TEXT NOT NULL PRIMARY KEY,
  value INTEGER NOT NULL,
  classification TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now'))
);
