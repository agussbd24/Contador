import { Kline, Ticker } from '../types';
import { CONFIG } from '../types/config';

export async function fetchKlines(interval: string = '4h', limit: number = 500): Promise<Kline[]> {
  const url = `${CONFIG.BINANCE_REST_URL}/klines?symbol=${CONFIG.SYMBOL}&interval=${interval}&limit=${limit}`;

  try {
    const resp = await fetch(url);
    if (!resp.ok) {
      console.error(`Binance klines HTTP ${resp.status}`);
      return generateMockKlines(interval, limit);
    }
    const data: any[][] = await resp.json();
    return data.map((k) => ({
      time: k[0],
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5]),
      trades: parseInt(k[8]),
    }));
  } catch (e) {
    console.error('Binance klines error:', e);
    return generateMockKlines(interval, limit);
  }
}

export async function fetchTicker(): Promise<Ticker> {
  const url = `${CONFIG.BINANCE_REST_URL}/ticker/24hr?symbol=${CONFIG.SYMBOL}`;

  try {
    const resp = await fetch(url);
    if (!resp.ok) {
      console.error(`Binance ticker HTTP ${resp.status}`);
      return generateMockTicker();
    }
    const data: any = await resp.json();
    return {
      symbol: data.symbol,
      price: parseFloat(data.lastPrice),
      change_24h: parseFloat(data.priceChangePercent),
      high_24h: parseFloat(data.highPrice),
      low_24h: parseFloat(data.lowPrice),
      volume_24h: parseFloat(data.volume),
      quote_volume_24h: parseFloat(data.quoteVolume),
    };
  } catch (e) {
    console.error('Binance ticker error:', e);
    return generateMockTicker();
  }
}

export async function fetchAllKlines(): Promise<Record<string, Kline[]>> {
  const timeframes = ['5m', '15m', '1h', '4h', '1d'];
  const results: Record<string, Kline[]> = {};

  const promises = timeframes.map(async (tf) => {
    results[tf] = await fetchKlines(tf, 500);
  });

  await Promise.all(promises);
  return results;
}

function generateMockKlines(interval: string, limit: number): Kline[] {
  const intervalSeconds: Record<string, number> = {
    '5m': 300, '15m': 900, '1h': 3600, '4h': 14400, '1d': 86400,
  };
  const seconds = intervalSeconds[interval] || 3600;
  const now = Date.now();
  const klines: Kline[] = [];
  let price = 142;

  for (let i = 0; i < limit; i++) {
    const t = now - seconds * (limit - i) * 1000;
    const change = (Math.random() - 0.5) * 0.04;
    const open = price;
    const close = price * (1 + change);
    const high = Math.max(open, close) * (1 + Math.random() * 0.005);
    const low = Math.min(open, close) * (1 - Math.random() * 0.005);
    const volume = 50000 + Math.random() * 450000;

    klines.push({
      time: t,
      open: Math.round(open * 10000) / 10000,
      high: Math.round(high * 10000) / 10000,
      low: Math.round(low * 10000) / 10000,
      close: Math.round(close * 10000) / 10000,
      volume: Math.round(volume * 100) / 100,
      trades: Math.floor(1000 + Math.random() * 49000),
    });
    price = close;
  }
  return klines;
}

function generateMockTicker(): Ticker {
  const price = 142 + (Math.random() - 0.5) * 10;
  return {
    symbol: 'SOLUSDT',
    price: Math.round(price * 100) / 100,
    change_24h: Math.round((Math.random() - 0.5) * 10 * 100) / 100,
    high_24h: Math.round(price * 1.03 * 100) / 100,
    low_24h: Math.round(price * 0.97 * 100) / 100,
    volume_24h: Math.round((5e8 + Math.random() * 1.5e9) * 100) / 100,
    quote_volume_24h: Math.round((5e8 + Math.random() * 1.5e9) * 100) / 100,
  };
}
