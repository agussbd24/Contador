const API_BASE = 'https://solana-quant.agussbd24.workers.dev';

async function fetchWithTimeout(url: string, ms = 15000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export interface SignalData {
  signal: string;
  confidence: number;
  composite_score: number;
  price: number;
  fear_greed: number;
  breakdown: { technical: number; onchain: number; sentiment: number; fundamental: number; risk: number; };
  risk_levels: { stop_loss: number; take_profit: number; rr_ratio: number; position_size_pct: number; };
  technical: { indicators: Record<string, number>; interpretation: Record<string, string>; normalized: number; };
  onchain: { metrics: Record<string, any>; interpretation: Record<string, string>; normalized: number; };
  sentiment: { score: number; interpretation: Record<string, any>; };
  ars: { price: number; stop_loss: number; take_profit: number; };
  dolar: { blue: number; oficial: number; tarjeta: number; };
}

export interface MarketData {
  ticker: {
    price: number; change_24h: number; high_24h: number; low_24h: number; volume_24h: number;
    ars: { blue: number; oficial: number; tarjeta: number; };
  };
  fear_greed: { value: number; classification: string; };
  dolar: { blue: number; oficial: number; tarjeta: number; };
  coingecko?: { market_cap: number; market_cap_rank: number; ath: number; price_change_7d: number; circulating_supply: number; total_supply: number; };
}

export interface MarketOverview {
  btc: { price: number; change_24h: number; volume: number } | null;
  eth: { price: number; change_24h: number; volume: number } | null;
  sol: { price: number; change_24h: number; volume: number } | null;
  fear_greed: { value: number; classification: string };
  dolar: { blue: number; oficial: number; tarjeta: number };
  total_market_cap: number;
  btc_dominance: number;
  eth_dominance: number;
}

export async function fetchSignal(): Promise<SignalData> {
  const res = await fetchWithTimeout(`${API_BASE}/signal`, 25000);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchMarket(): Promise<MarketData> {
  const res = await fetchWithTimeout(`${API_BASE}/market`, 15000);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchMarketOverview(): Promise<MarketOverview | null> {
  try {
    const res = await fetchWithTimeout(`${API_BASE}/market/overview`, 12000);
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

export async function fetchPriceHistory(): Promise<number[]> {
  try {
    const res = await fetchWithTimeout(`${API_BASE}/price/history`, 10000);
    if (!res.ok) return [];
    const data = await res.json();
    return data.prices || [];
  } catch { return []; }
}

export async function fetchHistory(): Promise<{ time: string; signal: string; confidence: number; composite_score: number; price: number; }[]> {
  try {
    const res = await fetchWithTimeout(`${API_BASE}/signals/history`, 10000);
    if (!res.ok) return [];
    const data = await res.json();
    return data.signals || [];
  } catch { return []; }
}

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(`${API_BASE}/health`, 5000);
    if (!res.ok) return false;
    const data = await res.json();
    return data.status === 'healthy';
  } catch { return false; }
}
