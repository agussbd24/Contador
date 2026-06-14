import { CONFIG } from '../types/config';

let cachedDolar: { blue: number; oficial: number; tarjeta: number; ts: number } | null = null;

export async function fetchDolarArg(kv?: KVNamespace): Promise<{ blue: number; oficial: number; tarjeta: number }> {
  const now = Date.now();

  // Check memory cache (10 min)
  if (cachedDolar && now - cachedDolar.ts < 600000) {
    return { blue: cachedDolar.blue, oficial: cachedDolar.oficial, tarjeta: cachedDolar.tarjeta };
  }

  // Check KV cache (10 min)
  if (kv) {
    try {
      const cached = await kv.get('dolar_arg', { type: 'json' }) as { blue: number; oficial: number; tarjeta: number; ts: number } | null;
      if (cached && now - cached.ts < 600000) {
        cachedDolar = cached;
        return { blue: cached.blue, oficial: cached.oficial, tarjeta: cached.tarjeta };
      }
    } catch {}
  }
  // Try multiple free APIs for Argentine dollar
  const tryApi = async (url: string, parser: (data: any) => { blue: number; oficial: number; tarjeta: number } | null): Promise<{ blue: number; oficial: number; tarjeta: number } | null> => {
    try {
      const resp = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (!resp.ok) return null;
      const data = await resp.json();
      return parser(data);
    } catch { return null; }
  };

  // API 1: argentinadatos.com
  const r1 = await tryApi('https://api.argentinadatos.com/v1/cotizaciones/dolares', (data) => {
    const oficial = data?.find((d: any) => d.casa === 'oficial');
    const blue = data?.find((d: any) => d.casa === 'blue');
    const tarjeta = data?.find((d: any) => d.casa === 'tarjeta');
    if (!blue?.venta) return null;
    return {
      blue: Math.round(blue.venta),
      oficial: oficial?.venta ? Math.round(oficial.venta) : Math.round(blue.venta * 0.87),
      tarjeta: tarjeta?.venta ? Math.round(tarjeta.venta) : Math.round(blue.venta * 1.3),
    };
  });
  if (r1 && r1.blue > 100) { await saveDolarCache(r1, kv); return r1; }

  // API 2: dolarapi.com
  const r2 = await tryApi('https://dolarapi.com/v1/dolares', (data) => {
    const oficial = data?.find((d: any) => d.casa?.nombre === 'Oficial');
    const blue = data?.find((d: any) => d.casa?.nombre === 'Blue');
    const tarjeta = data?.find((d: any) => d.casa?.nombre === 'Tarjeta de crédito');
    if (!blue?.venta) return null;
    return {
      blue: Math.round(blue.venta),
      oficial: oficial?.venta ? Math.round(oficial.venta) : Math.round(blue.venta * 0.87),
      tarjeta: tarjeta?.venta ? Math.round(tarjeta.venta) : Math.round(blue.venta * 1.3),
    };
  });
  if (r2 && r2.blue > 100) { await saveDolarCache(r2, kv); return r2; }

  // API 3: criptoya.com
  const r3 = await tryApi('https://criptoya.com/api/dolar', (data) => {
    if (!data?.blue?.price) return null;
    return {
      blue: Math.round(data.blue.price),
      oficial: data.oficial?.price ? Math.round(data.oficial.price) : Math.round(data.blue.price * 0.87),
      tarjeta: data.tarjeta?.price ? Math.round(data.tarjeta.price) : Math.round(data.blue.price * 1.3),
    };
  });
  if (r3 && r3.blue > 100) { await saveDolarCache(r3, kv); return r3; }

  return { blue: 1200, oficial: 1050, tarjeta: 1560 };
}

async function saveDolarCache(d: { blue: number; oficial: number; tarjeta: number }, kv?: KVNamespace): Promise<void> {
  const entry = { ...d, ts: Date.now() };
  cachedDolar = entry;
  if (kv) {
    try { await kv.put('dolar_arg', JSON.stringify(entry), { expirationTtl: 600 }); } catch {}
  }
}

export async function fetchFearGreed(): Promise<{ value: number; classification: string }> {
  try {
    const resp = await fetch(`${CONFIG.FEAR_GREED_URL}?limit=1`);
    if (!resp.ok) return { value: 50, classification: 'Neutral' };
    const data = await resp.json();
    if (data.data && data.data.length > 0) {
      return {
        value: parseInt(data.data[0].value),
        classification: data.data[0].value_classification,
      };
    }
    return { value: 50, classification: 'Neutral' };
  } catch (e) {
    console.error('Fear & Greed error:', e);
    return { value: 50, classification: 'Neutral' };
  }
}

export async function fetchCoinGecko(): Promise<Record<string, any>> {
  const key = CONFIG.COINGECKO_API_KEY ? `&x-cg-demo-api-key=${CONFIG.COINGECKO_API_KEY}` : '';
  const url = `${CONFIG.COINGECKO_BASE_URL}/coins/solana?localization=false&tickers=false&market_data=true&community_data=true&developer_data=false${key}`;

  try {
    const resp = await fetch(url);
    if (!resp.ok) return {};
    const data = await resp.json();
    const md = data.market_data || {};
    return {
      market_cap: md.market_cap?.usd || 0,
      market_cap_rank: md.market_cap_rank || 0,
      total_volume: md.total_volume?.usd || 0,
      circulating_supply: md.circulating_supply || 0,
      total_supply: md.total_supply || 0,
      ath: md.ath?.usd || 0,
      price_change_24h: md.price_change_percentage_24h || 0,
      price_change_7d: md.price_change_percentage_7d || 0,
      reddit_subscribers: data.community_data?.reddit_subscribers || 0,
    };
  } catch (e) {
    console.error('CoinGecko error:', e);
    return {};
  }
}
