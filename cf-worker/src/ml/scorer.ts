import { Signal } from '../types';
import { CONFIG } from '../types/config';

export function calculateSignal(
  technicalScore: number,
  onchainScore: number,
  sentimentScore: number,
  fundamentalScore: number,
  riskScore: number,
  currentPrice: number,
  atr: number,
): Signal {
  const t = technicalScore / 10;
  const o = onchainScore / 10;
  const s = sentimentScore / 10;
  const f = fundamentalScore / 10;
  const r = riskScore / 10;

  const composite =
    t * CONFIG.TECHNICAL_WEIGHTS.technical +
    o * CONFIG.TECHNICAL_WEIGHTS.onchain +
    s * CONFIG.TECHNICAL_WEIGHTS.sentiment +
    f * CONFIG.TECHNICAL_WEIGHTS.fundamental +
    r * CONFIG.TECHNICAL_WEIGHTS.risk;

  const factors = [t, o, s, f];
  const mean = factors.reduce((a, b) => a + b, 0) / factors.length;
  const variance = factors.reduce((a, b) => a + (b - mean) ** 2, 0) / factors.length;
  const agreement = 1 - Math.min(Math.sqrt(variance), 1);

  let signalType: Signal['signal'] = 'HOLD';
  if (composite > 0.5) signalType = 'STRONG_BUY';
  else if (composite > 0.2) signalType = 'BUY';
  else if (composite > -0.2) signalType = 'HOLD';
  else if (composite > -0.5) signalType = 'SELL';
  else signalType = 'STRONG_SELL';

  const confidence = Math.min(100, Math.max(0, Math.round(
    Math.abs(composite) * 60 + agreement * 30 + 10,
  )));

  let stopLoss = 0, takeProfit = 0, rrRatio = 0, riskPct = 0, rewardPct = 0;
  if (currentPrice > 0 && atr > 0 && signalType !== 'HOLD') {
    const direction = signalType.includes('BUY') ? 1 : -1;
    stopLoss = currentPrice - direction * 2 * atr;
    takeProfit = currentPrice + direction * 3 * atr;
    const risk = Math.abs(currentPrice - stopLoss);
    const reward = Math.abs(takeProfit - currentPrice);
    rrRatio = Math.round((reward / risk) * 100) / 100;
    riskPct = Math.round((risk / currentPrice) * 10000) / 100;
    rewardPct = Math.round((reward / currentPrice) * 10000) / 100;
  }

  return {
    signal: signalType,
    confidence,
    composite_score: Math.round(composite * 10000) / 10000,
    price: currentPrice,
    breakdown: {
      technical: Math.round(technicalScore * 100) / 100,
      onchain: Math.round(onchainScore * 100) / 100,
      sentiment: Math.round(sentimentScore * 100) / 100,
      fundamental: Math.round(fundamentalScore * 100) / 100,
      risk: Math.round(riskScore * 100) / 100,
    },
    risk_levels: { entry: currentPrice, stop_loss: stopLoss, take_profit: takeProfit, rr_ratio: rrRatio, risk_pct: riskPct, reward_pct: rewardPct },
    filter_reasons: [],
    technical: { raw: technicalScore, normalized: technicalScore, indicators: {} },
    onchain: { raw: onchainScore, normalized: onchainScore, metrics: {} },
    sentiment: { score: sentimentScore, classification: 'NEUTRAL', breakdown: {} },
    fear_greed: 50,
    time: new Date().toISOString(),
  };
}

export function applyFilters(signalData: Signal, marketData: Record<string, any>): Signal {
  let confidence = signalData.confidence;
  const reasons: string[] = [];

  if (signalData.signal === 'HOLD') return signalData;

  const high24h = marketData.high_24h || 0;
  const low24h = marketData.low_24h || 0;
  const price = marketData.price || 1;
  const range24h = price > 0 ? (high24h - low24h) / price : 0;
  if (range24h < 0.02) { confidence -= 30; reasons.push('RANGE_BOUND'); }

  const volRatio = marketData.volume_ratio || 1;
  if (volRatio < 0.5) { confidence -= 25; reasons.push('LOW_VOLUME'); }

  if (marketData.fear_greed > 90 || marketData.fear_greed < 10) {
    confidence -= 20;
    reasons.push('EXTREME_SENTIMENT');
  }

  signalData.confidence = Math.max(0, confidence);
  signalData.filter_reasons = reasons;

  if (signalData.confidence < 30) {
    signalData.signal = 'HOLD';
    signalData.confidence = 0;
  }

  return signalData;
}

export function validateRisk(signalData: Signal): Signal {
  const rr = signalData.risk_levels.rr_ratio;
  if (rr < CONFIG.MIN_RR_RATIO && signalData.signal !== 'HOLD') {
    signalData.confidence = Math.max(0, signalData.confidence - 20);
    signalData.filter_reasons.push(`LOW_RR_${rr}`);
  }
  if (signalData.risk_levels.risk_pct > 5) {
    signalData.confidence = Math.max(0, signalData.confidence - 15);
    signalData.filter_reasons.push(`HIGH_RISK_${signalData.risk_levels.risk_pct}%`);
  }
  return signalData;
}
