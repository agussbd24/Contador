export interface Env {
  DB: D1Database;
  KV: KVNamespace;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_CHAT_ID: string;
  COINGECKO_API_KEY: string;
}

export interface Kline {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  trades: number;
}

export interface Ticker {
  symbol: string;
  price: number;
  change_24h: number;
  high_24h: number;
  low_24h: number;
  volume_24h: number;
  quote_volume_24h: number;
}

export interface TechnicalScore {
  raw: number;
  normalized: number;
  indicators: Record<string, any>;
  interpretation?: Record<string, string>;
}

export interface OnChainScore {
  raw: number;
  normalized: number;
  metrics: Record<string, number>;
  interpretation?: Record<string, string>;
}

export interface SentimentScore {
  score: number;
  classification: string;
  breakdown: Record<string, number>;
  interpretation?: Record<string, string>;
}

export interface Signal {
  signal: 'STRONG_BUY' | 'BUY' | 'ACCUMULATE' | 'HOLD' | 'DISTRIBUTE' | 'SELL' | 'STRONG_SELL';
  confidence: number;
  composite_score: number;
  price: number;
  breakdown: {
    technical: number;
    onchain: number;
    sentiment: number;
    fundamental: number;
    risk: number;
  };
  risk_levels: {
    entry: number;
    stop_loss: number;
    take_profit: number;
    rr_ratio: number;
    risk_pct: number;
    reward_pct: number;
  };
  filter_reasons: string[];
  technical: TechnicalScore;
  onchain: OnChainScore;
  sentiment: SentimentScore;
  fear_greed: number;
  time: string;
}
