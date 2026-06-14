const API_BASE = import.meta.env.VITE_API_URL || '';

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
}

export async function fetchSignal(): Promise<SignalData> {
  const res = await fetch(`${API_BASE}/signal`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchMarket(): Promise<MarketData> {
  const res = await fetch(`${API_BASE}/market`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchHistory(): Promise<{ time: string; signal: string; confidence: number; composite_score: number; }[]> {
  const res = await fetch(`${API_BASE}/signals/history`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.signals || [];
}

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`);
    if (!res.ok) return false;
    const data = await res.json();
    return data.status === 'healthy';
  } catch {
    return false;
  }
}
