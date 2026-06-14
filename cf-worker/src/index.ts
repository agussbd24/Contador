import { Env, Signal } from './types';
import { fetchKlines, fetchTicker, fetchAllKlines } from './fetchers/binance';
import { fetchFearGreed, fetchCoinGecko } from './fetchers/coingecko';
import { analyzeTechnical } from './analysis/technical';
import { analyzeOnChain } from './analysis/onchain';
import { analyzeSentiment } from './analysis/sentiment';
import { calculateSignal, applyFilters, validateRisk } from './ml/scorer';
import { sendTelegramMessage, formatSignalAlert, formatDailySummary } from './alerts/telegram';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      let response: Response;

      switch (path) {
        case '/':
          response = json({ name: 'Solana Quant Platform', version: '2.0.0', engine: 'Cloudflare Workers', status: 'running' });
          break;
        case '/health':
          response = await handleHealth(env);
          break;
        case '/price':
          response = await handlePrice();
          break;
        case '/signal':
          response = await handleSignal(env);
          break;
        case '/market':
          response = await handleMarket(env);
          break;
        case '/klines/5m':
        case '/klines/15m':
        case '/klines/1h':
        case '/klines/4h':
        case '/klines/1d':
          const tf = path.split('/')[2];
          response = await handleKlines(tf);
          break;
        case '/signals/history':
          response = await handleSignalHistory(env);
          break;
        default:
          response = json({ error: 'Not found' }, 404);
      }

      Object.entries(corsHeaders).forEach(([k, v]) => response.headers.set(k, v));
      return response;

    } catch (e: any) {
      return json({ error: e.message }, 500);
    }
  },

  async scheduled(event: any, env: Env): Promise<void> {
    console.log('Running scheduled analysis...');
    try {
      await runAnalysisAndAlert(env);
    } catch (e) {
      console.error('Scheduled analysis error:', e);
    }
  },
};

// ─── API HANDLERS ───

async function handleHealth(env: Env): Promise<Response> {
  let dbOk = false;
  try {
    await env.DB.prepare('SELECT 1').first();
    dbOk = true;
  } catch (e) {}

  return json({
    status: 'healthy',
    engine: 'cloudflare-workers',
    components: {
      database: dbOk ? 'connected' : 'not_configured',
      telegram: env.TELEGRAM_BOT_TOKEN ? 'configured' : 'not_configured',
    },
  });
}

async function handlePrice(): Promise<Response> {
  const ticker = await fetchTicker();
  return json(ticker);
}

async function handleKlines(timeframe: string): Promise<Response> {
  const klines = await fetchKlines(timeframe, 100);
  return json({ timeframe, count: klines.length, data: klines });
}

async function handleSignal(env: Env): Promise<Response> {
  const ticker = await fetchTicker();
  const klines = await fetchAllKlines();
  const fg = await fetchFearGreed();

  const techResult = analyzeTechnical(klines['4h'] || []);
  const onchainResult = analyzeOnChain({
    exchange_inflow: 0, exchange_outflow: 5000,
    whale_transactions_count: 3, whale_volume_sol: 25000,
    active_addresses: 1200000, new_addresses: 45000,
    staking_ratio: 0.67, exchange_reserve_change: -0.015,
    nvt_ratio: 42,
  });
  const sentimentResult = analyzeSentiment(
    { reddit: 0.2, twitter: 0.1, fear_greed: (fg.value - 50) / 50, news: 0.15 },
    fg.value,
  );

  let fundamentalScore = 0;
  if (ticker.volume_24h > 1e9) fundamentalScore += 2;

  let riskScore = 7;
  if (ticker.change_24h < -10) riskScore -= 2;

  let result = calculateSignal(
    techResult.normalized, onchainResult.normalized, sentimentResult.score,
    fundamentalScore, riskScore, ticker.price, techResult.indicators.atr || 0,
  );

  result = applyFilters(result, {
    price: ticker.price, high_24h: ticker.high_24h, low_24h: ticker.low_24h,
    volume_ratio: techResult.indicators.volume_ratio || 1, fear_greed: fg.value,
  });

  result = validateRisk(result);
  result.fear_greed = fg.value;
  result.technical = techResult;
  result.onchain = onchainResult;
  result.sentiment = sentimentResult;

  // Store in D1
  try {
    await env.DB.prepare(
      `INSERT INTO signals (time, signal, confidence, composite_score, technical_score, onchain_score, sentiment_score, price, stop_loss, take_profit, rr_ratio)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      new Date().toISOString(), result.signal, result.confidence, result.composite_score,
      result.breakdown.technical, result.breakdown.onchain, result.breakdown.sentiment,
      result.price, result.risk_levels.stop_loss, result.risk_levels.take_profit, result.risk_levels.rr_ratio,
    ).run();
  } catch (e) {
    console.error('D1 write error:', e);
  }

  return json(result);
}

async function handleMarket(env: Env): Promise<Response> {
  const [ticker, fg, cg] = await Promise.all([fetchTicker(), fetchFearGreed(), fetchCoinGecko()]);
  return json({ ticker, fear_greed: fg, coingecko: cg });
}

async function handleSignalHistory(env: Env): Promise<Response> {
  try {
    const { results } = await env.DB.prepare(
      'SELECT * FROM signals ORDER BY time DESC LIMIT 50',
    ).all();
    return json({ signals: results });
  } catch (e) {
    return json({ signals: [] });
  }
}

async function runAnalysisAndAlert(env: Env): Promise<void> {
  const ticker = await fetchTicker();
  const klines = await fetchAllKlines();
  const fg = await fetchFearGreed();

  const techResult = analyzeTechnical(klines['4h'] || []);
  const onchainResult = analyzeOnChain({
    exchange_inflow: 0, exchange_outflow: 5000,
    whale_transactions_count: 3, whale_volume_sol: 25000,
    active_addresses: 1200000, new_addresses: 45000,
    staking_ratio: 0.67, exchange_reserve_change: -0.015,
    nvt_ratio: 42,
  });
  const sentimentResult = analyzeSentiment(
    { reddit: 0.2, twitter: 0.1, fear_greed: (fg.value - 50) / 50, news: 0.15 },
    fg.value,
  );

  let fundamentalScore = 0;
  if (ticker.volume_24h > 1e9) fundamentalScore += 2;
  let riskScore = 7;
  if (ticker.change_24h < -10) riskScore -= 2;

  let result = calculateSignal(
    techResult.normalized, onchainResult.normalized, sentimentResult.score,
    fundamentalScore, riskScore, ticker.price, techResult.indicators.atr || 0,
  );

  result = applyFilters(result, {
    price: ticker.price, high_24h: ticker.high_24h, low_24h: ticker.low_24h,
    volume_ratio: techResult.indicators.volume_ratio || 1, fear_greed: fg.value,
  });

  result = validateRisk(result);
  result.fear_greed = fg.value;

  // Store in D1
  try {
    await env.DB.prepare(
      `INSERT INTO signals (time, signal, confidence, composite_score, technical_score, onchain_score, sentiment_score, price, stop_loss, take_profit, rr_ratio)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      new Date().toISOString(), result.signal, result.confidence, result.composite_score,
      result.breakdown.technical, result.breakdown.onchain, result.breakdown.sentiment,
      result.price, result.risk_levels.stop_loss, result.risk_levels.take_profit, result.risk_levels.rr_ratio,
    ).run();
  } catch (e) {
    console.error('D1 write error:', e);
  }

  // Send alert if needed
  if (result.signal !== 'HOLD' && result.confidence >= 50) {
    const lastAlert = await env.KV.get('last_alert_time');
    const now = Date.now();
    if (!lastAlert || now - parseInt(lastAlert) > 3600000) {
      const msg = formatSignalAlert(result);
      const sent = await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHAT_ID, msg);
      if (sent) {
        await env.KV.put('last_alert_time', now.toString());
      }
    }
  }

  console.log(`Analysis: ${result.signal} (${result.confidence}%) @ $${result.price}`);
}

function json(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
