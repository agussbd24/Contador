export const CONFIG = {
  BINANCE_REST_URL: 'https://api.binance.com/api/v3',
  COINGECKO_BASE_URL: 'https://api.coingecko.com/api/v3',
  FEAR_GREED_URL: 'https://api.alternative.me/fng/',
  SYMBOL: 'SOLUSDT',

  TECHNICAL_WEIGHTS: {
    technical: 0.35,
    onchain: 0.30,
    sentiment: 0.20,
    fundamental: 0.10,
    risk: 0.05,
  },

  MIN_CONFIDENCE: 50,
  MIN_RR_RATIO: 1.5,
  SIGNAL_COOLDOWN_SECONDS: 3600,
  RISK_PER_TRADE: 0.01,
};
