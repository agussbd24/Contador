import { SentimentScore } from '../types';

const CRYPTO_LEXICON: Record<string, number> = {
  moon: 0.8, bullish: 0.7, pump: 0.6, breakout: 0.5,
  accumulate: 0.4, 'buy the dip': 0.6, hodl: 0.3, stake: 0.2,
  ath: 0.6, 'all time high': 0.7, 'bull run': 0.8, parabolic: 0.7,
  dump: -0.7, bearish: -0.6, rekt: -0.9, crash: -0.8,
  rug: -0.9, 'rug pull': -0.9, scam: -0.8, sell: -0.3,
  fud: -0.5, fear: -0.4, panic: -0.7, capitulation: -0.6,
  fomo: 0.5, euphoria: 0.6, 'top signal': -0.7, distribution: -0.4,
  whale: 0.2, adoption: 0.5, partnership: 0.4, upgrade: 0.3,
};

function simpleSentiment(text: string): { compound: number; positive: number; negative: number; emotion: string } {
  const lower = text.toLowerCase();
  let pos = 0, neg = 0;

  for (const [term, value] of Object.entries(CRYPTO_LEXICON)) {
    if (lower.includes(term)) {
      if (value > 0) pos += value;
      else neg += Math.abs(value);
    }
  }

  const total = pos + neg;
  const compound = total === 0 ? 0 : (pos - neg) / total;

  const fomoTerms = ['fomo', 'cant miss', 'last chance', 'going to moon', '100x'];
  const panicTerms = ['crash', 'scam', 'rug', 'getting out', 'sell everything'];

  let emotion = 'NEUTRAL';
  if (fomoTerms.some((t) => lower.includes(t))) emotion = 'FOMO';
  else if (panicTerms.some((t) => lower.includes(t))) emotion = 'PANIC';
  else if (compound > 0.6) emotion = 'EUFORIA';
  else if (compound > 0.3) emotion = 'OPTIMISM';
  else if (compound < -0.6) emotion = 'PANIC';
  else if (compound < -0.3) emotion = 'PESSIMISM';

  return { compound, positive: pos / Math.max(total, 1), negative: neg / Math.max(total, 1), emotion };
}

export function analyzeSentiment(sourceScores: Record<string, number>, fearGreed: number): SentimentScore {
  const weights: Record<string, number> = {
    reddit: 0.3, twitter: 0.3, fear_greed: 0.25, news: 0.15,
  };

  let weightedScore = 0;
  let totalWeight = 0;

  for (const [source, score] of Object.entries(sourceScores)) {
    const w = weights[source] || 0.1;
    weightedScore += score * w;
    totalWeight += w;
  }

  if (totalWeight > 0) weightedScore /= totalWeight;

  const fgAdjusted = (fearGreed - 50) / 50;
  weightedScore = weightedScore * 0.7 + fgAdjusted * 0.3;

  let classification = 'NEUTRAL';
  if (weightedScore > 0.6) classification = 'EXTREME_GREED';
  else if (weightedScore > 0.3) classification = 'GREED';
  else if (weightedScore < -0.6) classification = 'EXTREME_FEAR';
  else if (weightedScore < -0.3) classification = 'FEAR';

  const normalized = Math.max(-10, Math.min(10, weightedScore * 10));

  const interpretation: Record<string, string> = {};
  interpretation.overall = classification.replace('_', ' ');
  interpretation.fear_greed = fearGreed > 70 ? 'Codicia extrema' : fearGreed < 30 ? 'Miedo extremo' : 'Neutral';
  interpretation.reddit = sourceScores.reddit > 0.3 ? 'Positivo' : sourceScores.reddit < -0.3 ? 'Negativo' : 'Neutral';
  interpretation.news = sourceScores.news > 0.3 ? 'Positivo' : sourceScores.news < -0.3 ? 'Negativo' : 'Neutral';

  return { score: normalized, classification, breakdown: sourceScores, interpretation };
}
