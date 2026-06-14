import { Kline, TechnicalScore } from '../types';

export function analyzeTechnical(klines: Kline[]): TechnicalScore {
  if (klines.length < 50) {
    return { raw: 0, normalized: 0, indicators: {} };
  }

  const closes = klines.map((k) => k.close);
  const highs = klines.map((k) => k.high);
  const lows = klines.map((k) => k.low);
  const volumes = klines.map((k) => k.volume);

  const indicators: Record<string, any> = {};
  let score = 0;

  // RSI
  const rsi = calcRSI(closes, 14);
  indicators.rsi_14 = rsi[rsi.length - 1] || 50;
  if (indicators.rsi_14 < 30) score += 2;
  else if (indicators.rsi_14 < 40) score += 1;
  else if (indicators.rsi_14 > 70) score -= 2;
  else if (indicators.rsi_14 > 60) score -= 1;

  // MACD
  const { macd, signal, histogram } = calcMACD(closes);
  indicators.macd = macd[macd.length - 1] || 0;
  indicators.macd_signal = signal[signal.length - 1] || 0;
  indicators.macd_histogram = histogram[histogram.length - 1] || 0;
  if (macd.length > 1 && signal.length > 1) {
    if (macd[macd.length - 1] > signal[signal.length - 1] && macd[macd.length - 2] <= signal[signal.length - 2]) score += 2;
    else if (macd[macd.length - 1] < signal[signal.length - 1] && macd[macd.length - 2] >= signal[signal.length - 2]) score -= 2;
    if (histogram[histogram.length - 1] > 0) score += 0.5;
    else score -= 0.5;
  }

  // EMA Ribbon (9, 21, 50)
  const ema9 = calcEMA(closes, 9);
  const ema21 = calcEMA(closes, 21);
  const ema50 = calcEMA(closes, 50);
  indicators.ema_9 = ema9[ema9.length - 1] || closes[closes.length - 1];
  indicators.ema_21 = ema21[ema21.length - 1] || closes[closes.length - 1];
  indicators.ema_50 = ema50[ema50.length - 1] || closes[closes.length - 1];

  if (ema9.length > 0 && ema21.length > 0 && ema50.length > 0) {
    const e9 = ema9[ema9.length - 1];
    const e21 = ema21[ema21.length - 1];
    const e50 = ema50[ema50.length - 1];
    if (e9 > e21 && e21 > e50) score += 3;
    else if (e9 < e21 && e21 < e50) score -= 3;
    else if (e9 > e21) score += 1;
    else if (e9 < e21) score -= 1;
  }

  // Bollinger Bands
  const { upper, middle, lower } = calcBollinger(closes, 20, 2);
  indicators.bb_upper = upper[upper.length - 1] || closes[closes.length - 1];
  indicators.bb_middle = middle[middle.length - 1] || closes[closes.length - 1];
  indicators.bb_lower = lower[lower.length - 1] || closes[closes.length - 1];

  if (upper.length > 0) {
    const bbWidth = (upper[upper.length - 1] - lower[lower.length - 1]) / middle[middle.length - 1];
    indicators.bb_width = bbWidth;
    if (bbWidth < 0.005) score += 0.5;
    if (closes[closes.length - 1] < lower[lower.length - 1]) score += 1.5;
    else if (closes[closes.length - 1] > upper[upper.length - 1]) score -= 1.5;
  }

  // ATR
  const atr = calcATR(highs, lows, closes, 14);
  indicators.atr = atr[atr.length - 1] || 0;

  // VWAP
  const vwap = calcVWAP(highs, lows, closes, volumes);
  indicators.vwap = vwap;
  if (closes[closes.length - 1] > vwap) score += 1;
  else score -= 1;

  // OBV
  const obv = calcOBV(closes, volumes);
  indicators.obv_trend = obv.length > 5 && obv[obv.length - 1] > obv[obv.length - 5] ? 'up' : 'down';
  if (obv.length > 5 && obv[obv.length - 1] > obv[obv.length - 5]) score += 1;
  else if (obv.length > 5 && obv[obv.length - 1] < obv[obv.length - 5]) score -= 1;

  // Volume analysis
  const volAvg = volumes.slice(-20).reduce((a, b) => a + b, 0) / Math.min(20, volumes.length);
  indicators.volume_ratio = volAvg > 0 ? volumes[volumes.length - 1] / volAvg : 1;
  if (indicators.volume_ratio > 2.0) {
    score += closes[closes.length - 1] > closes[closes.length - 2] ? 2 : -2;
  } else if (indicators.volume_ratio > 1.5) {
    score += closes[closes.length - 1] > closes[closes.length - 2] ? 1 : -1;
  }

  // Order Blocks (simplified)
  indicators.order_blocks = detectOrderBlocks(closes);
  if (indicators.order_blocks.bullish_ob_break) score += 2;
  if (indicators.order_blocks.bearish_ob_break) score -= 2;

  // Liquidity Sweeps
  indicators.liquidity = detectLiquiditySweeps(closes, highs, lows);
  if (indicators.liquidity.bullish_sweep) score += 2;
  if (indicators.liquidity.bearish_sweep) score -= 2;

  const normalized = Math.max(-10, Math.min(10, score));

  return { raw: score, normalized, indicators };
}

// ─── INDICATOR FUNCTIONS ───

function calcRSI(closes: number[], period: number): number[] {
  const deltas = [];
  for (let i = 1; i < closes.length; i++) deltas.push(closes[i] - closes[i - 1]);

  if (deltas.length < period) return [50];

  const gains = deltas.map((d) => (d > 0 ? d : 0));
  const losses = deltas.map((d) => (d < 0 ? -d : 0));

  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

  const rsi: number[] = new Array(period).fill(50);
  for (let i = period; i < deltas.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
    rsi.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss));
  }
  return rsi;
}

function calcEMA(data: number[], period: number): number[] {
  if (data.length < period) return data.slice();
  const k = 2 / (period + 1);
  const ema: number[] = [];
  let prev = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
  ema.push(prev);
  for (let i = period; i < data.length; i++) {
    prev = (data[i] - prev) * k + prev;
    ema.push(prev);
  }
  return ema;
}

function calcMACD(closes: number[], fast = 12, slow = 26, sig = 9) {
  const emaFast = calcEMA(closes, fast);
  const emaSlow = calcEMA(closes, slow);
  const minLen = Math.min(emaFast.length, emaSlow.length);
  const macdLine: number[] = [];
  for (let i = 0; i < minLen; i++) macdLine.push(emaFast[emaFast.length - minLen + i] - emaSlow[emaSlow.length - minLen + i]);

  const signalLine = calcEMA(macdLine, sig);
  const histogram: number[] = [];
  const minLen2 = Math.min(macdLine.length, signalLine.length);
  for (let i = 0; i < minLen2; i++) {
    histogram.push(macdLine[macdLine.length - minLen2 + i] - signalLine[signalLine.length - minLen2 + i]);
  }
  return { macd: macdLine, signal: signalLine, histogram };
}

function calcBollinger(closes: number[], period: number, stdDev: number) {
  if (closes.length < period) return { upper: closes, middle: closes, lower: closes };
  const middle: number[] = [];
  const upper: number[] = [];
  const lower: number[] = [];
  for (let i = period - 1; i < closes.length; i++) {
    const slice = closes.slice(i - period + 1, i + 1);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period;
    const std = Math.sqrt(variance);
    middle.push(mean);
    upper.push(mean + stdDev * std);
    lower.push(mean - stdDev * std);
  }
  return { upper, middle, lower };
}

function calcATR(highs: number[], lows: number[], closes: number[], period: number): number[] {
  const tr: number[] = [];
  for (let i = 1; i < highs.length; i++) {
    tr.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1])));
  }
  if (tr.length < period) return [0];
  const atr: number[] = new Array(period).fill(0);
  let avg = tr.slice(0, period).reduce((a, b) => a + b, 0) / period;
  atr[period - 1] = avg;
  for (let i = period; i < tr.length; i++) {
    avg = (avg * (period - 1) + tr[i]) / period;
    atr.push(avg);
  }
  return atr;
}

function calcVWAP(highs: number[], lows: number[], closes: number[], volumes: number[]): number {
  let cumTPV = 0;
  let cumVol = 0;
  for (let i = 0; i < highs.length; i++) {
    const tp = (highs[i] + lows[i] + closes[i]) / 3;
    cumTPV += tp * volumes[i];
    cumVol += volumes[i];
  }
  return cumVol > 0 ? cumTPV / cumVol : closes[closes.length - 1];
}

function calcOBV(closes: number[], volumes: number[]): number[] {
  const obv: number[] = [0];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i] > closes[i - 1]) obv.push(obv[obv.length - 1] + volumes[i]);
    else if (closes[i] < closes[i - 1]) obv.push(obv[obv.length - 1] - volumes[i]);
    else obv.push(obv[obv.length - 1]);
  }
  return obv;
}

function detectOrderBlocks(closes: number[]) {
  const result = { bullish_ob_break: false, bearish_ob_break: false };
  if (closes.length < 20) return result;
  const recent = closes.slice(-20);

  let minIdx = 0;
  for (let i = 0; i < recent.length - 5; i++) if (recent[i] < recent[minIdx]) minIdx = i;
  if (minIdx < recent.length - 5 && closes[closes.length - 1] > recent[minIdx] * 1.01 && closes[closes.length - 2] <= recent[minIdx] * 1.01) {
    result.bullish_ob_break = true;
  }

  let maxIdx = 0;
  for (let i = 0; i < recent.length - 5; i++) if (recent[i] > recent[maxIdx]) maxIdx = i;
  if (maxIdx < recent.length - 5 && closes[closes.length - 1] < recent[maxIdx] * 0.99 && closes[closes.length - 2] >= recent[maxIdx] * 0.99) {
    result.bearish_ob_break = true;
  }

  return result;
}

function detectLiquiditySweeps(closes: number[], highs: number[], lows: number[]) {
  const result = { bullish_sweep: false, bearish_sweep: false };
  if (closes.length < 30) return result;

  const recentLows = lows.slice(-30, -5);
  const recentHighs = highs.slice(-30, -5);
  const lowest = Math.min(...recentLows);
  const highest = Math.max(...recentHighs);

  if (lows[lows.length - 1] < lowest && closes[closes.length - 1] > lowest) result.bullish_sweep = true;
  if (highs[highs.length - 1] > highest && closes[closes.length - 1] < highest) result.bearish_sweep = true;

  return result;
}
