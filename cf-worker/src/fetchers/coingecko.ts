import { CONFIG } from '../types/config';

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
