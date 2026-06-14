-- ═══════════════════════════════════════════════════════════
-- SOLANA QUANT PLATFORM - DATABASE SCHEMA
-- PostgreSQL 15
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS price_data (
    time TIMESTAMPTZ NOT NULL,
    symbol VARCHAR(20) NOT NULL DEFAULT 'SOLUSDT',
    open NUMERIC(20,8) NOT NULL,
    high NUMERIC(20,8) NOT NULL,
    low NUMERIC(20,8) NOT NULL,
    close NUMERIC(20,8) NOT NULL,
    volume NUMERIC(20,8) NOT NULL,
    trades INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (time, symbol)
);

CREATE INDEX IF NOT EXISTS idx_price_data_symbol_time ON price_data (symbol, time DESC);

CREATE TABLE IF NOT EXISTS technical_indicators (
    time TIMESTAMPTZ NOT NULL,
    symbol VARCHAR(20) NOT NULL DEFAULT 'SOLUSDT',
    timeframe VARCHAR(10) NOT NULL,
    rsi_14 NUMERIC(10,4),
    rsi_7 NUMERIC(10,4),
    macd NUMERIC(20,8),
    macd_signal NUMERIC(20,8),
    macd_histogram NUMERIC(20,8),
    ema_9 NUMERIC(20,8),
    ema_21 NUMERIC(20,8),
    ema_50 NUMERIC(20,8),
    ema_200 NUMERIC(20,8),
    bb_upper NUMERIC(20,8),
    bb_middle NUMERIC(20,8),
    bb_lower NUMERIC(20,8),
    atr NUMERIC(20,8),
    adx NUMERIC(10,4),
    stoch_k NUMERIC(10,4),
    stoch_d NUMERIC(10,4),
    vwap NUMERIC(20,8),
    obv NUMERIC(20,8),
    computed_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (time, symbol, timeframe)
);

CREATE INDEX IF NOT EXISTS idx_ti_symbol_time ON technical_indicators (symbol, time DESC);

CREATE TABLE IF NOT EXISTS onchain_metrics (
    time TIMESTAMPTZ NOT NULL PRIMARY KEY,
    exchange_inflow NUMERIC(20,4),
    exchange_outflow NUMERIC(20,4),
    net_exchange_flow NUMERIC(20,4),
    whale_transactions_count INTEGER,
    whale_volume_sol NUMERIC(20,4),
    active_addresses INTEGER,
    new_addresses INTEGER,
    transaction_volume_sol NUMERIC(20,4),
    sol_staked NUMERIC(20,4),
    staking_ratio NUMERIC(10,6),
    exchange_reserve NUMERIC(20,4),
    computed_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sentiment_data (
    time TIMESTAMPTZ NOT NULL,
    source VARCHAR(50) NOT NULL,
    compound_score NUMERIC(5,4),
    positive_score NUMERIC(5,4),
    negative_score NUMERIC(5,4),
    neutral_score NUMERIC(5,4),
    emotion VARCHAR(20),
    text_sample TEXT,
    processed_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (time, source)
);

CREATE INDEX IF NOT EXISTS idx_sentiment_source_time ON sentiment_data (source, time DESC);

CREATE TABLE IF NOT EXISTS fear_greed_index (
    time TIMESTAMPTZ NOT NULL PRIMARY KEY,
    value INTEGER NOT NULL,
    classification VARCHAR(20) NOT NULL
);

CREATE TABLE IF NOT EXISTS signals (
    id SERIAL PRIMARY KEY,
    time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    symbol VARCHAR(20) NOT NULL DEFAULT 'SOLUSDT',
    signal VARCHAR(20) NOT NULL,
    confidence INTEGER NOT NULL,
    composite_score NUMERIC(5,4),
    technical_score NUMERIC(5,4),
    onchain_score NUMERIC(5,4),
    sentiment_score NUMERIC(5,4),
    fundamental_score NUMERIC(5,4),
    risk_score NUMERIC(5,4),
    price NUMERIC(20,8),
    stop_loss NUMERIC(20,8),
    take_profit NUMERIC(20,8),
    rr_ratio NUMERIC(5,2),
    filter_reasons JSONB,
    filters_applied BOOLEAN DEFAULT FALSE,
    model_version VARCHAR(20),
    outcome VARCHAR(20) DEFAULT 'PENDING',
    outcome_price NUMERIC(20,8),
    outcome_time TIMESTAMPTZ,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_signals_time ON signals (time DESC);
CREATE INDEX IF NOT EXISTS idx_signals_outcome ON signals (outcome);

CREATE TABLE IF NOT EXISTS alerts (
    id SERIAL PRIMARY KEY,
    signal_id INTEGER REFERENCES signals(id),
    time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    channel VARCHAR(50) NOT NULL DEFAULT 'telegram',
    status VARCHAR(20) NOT NULL DEFAULT 'SENT',
    message TEXT,
    error TEXT,
    sent_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS health_checks (
    time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    component VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL,
    latency_ms INTEGER,
    error_message TEXT,
    metadata JSONB
);

CREATE TABLE IF NOT EXISTS ml_models (
    id SERIAL PRIMARY KEY,
    version VARCHAR(20) NOT NULL UNIQUE,
    trained_at TIMESTAMP NOT NULL,
    training_samples INTEGER,
    train_score NUMERIC(5,4),
    val_score NUMERIC(5,4),
    test_score NUMERIC(5,4),
    features_used TEXT[],
    hyperparameters JSONB,
    is_active BOOLEAN DEFAULT FALSE,
    model_path VARCHAR(500),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS config (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW()
);
