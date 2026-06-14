export interface ExchangePrice {
  name: string;
  ask: number;
  bid: number;
  totalAsk: number;
  totalBid: number;
}

export interface CriptoYaData {
  exchanges: ExchangePrice[];
  fiwind: { ask: number; bid: number; totalAsk: number; totalBid: number } | null;
  bestBuy: ExchangePrice | null;
  bestSell: ExchangePrice | null;
}

export async function fetchCriptoYa(): Promise<CriptoYaData> {
  const empty: CriptoYaData = { exchanges: [], fiwind: null, bestBuy: null, bestSell: null };

  try {
    const resp = await fetch('https://criptoya.com/api/sol/ars', {
      headers: { 'Accept': 'application/json' },
    });
    if (!resp.ok) return empty;

    const data: Record<string, any> = await resp.json();
    const exchanges: ExchangePrice[] = [];

    for (const [name, info] of Object.entries(data)) {
      if (info && typeof info === 'object' && 'ask' in info && 'bid' in info) {
        exchanges.push({
          name,
          ask: info.ask,
          bid: info.bid,
          totalAsk: info.totalAsk || info.ask,
          totalBid: info.totalBid || info.bid,
        });
      }
    }

    const fiwind = data.fiwind || null;

    let bestBuy: ExchangePrice | null = null;
    let bestSell: ExchangePrice | null = null;

    for (const ex of exchanges) {
      if (!bestBuy || ex.totalAsk < bestBuy.totalAsk) bestBuy = ex;
      if (!bestSell || ex.totalBid > bestSell.totalBid) bestSell = ex;
    }

    return { exchanges, fiwind, bestBuy, bestSell };
  } catch (e) {
    console.error('CriptoYa error:', e);
    return empty;
  }
}
