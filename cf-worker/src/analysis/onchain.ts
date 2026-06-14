import { OnChainScore } from '../types';

export function analyzeOnChain(metrics: Record<string, number>): OnChainScore {
  let score = 0;

  const netFlow = (metrics.exchange_outflow || 0) - (metrics.exchange_inflow || 0);
  if (netFlow > 5000) score += 2;
  else if (netFlow > 1000) score += 1;
  else if (netFlow < -5000) score -= 2;
  else if (netFlow < -1000) score -= 1;

  const whaleVol = metrics.whale_volume_sol || 0;
  if (whaleVol > 100000) score += 2;
  else if (whaleVol > 50000) score += 1;

  if ((metrics.active_addresses || 0) > 1000000) score += 1;
  if ((metrics.new_addresses || 0) > 50000) score += 1;

  const stakingRatio = metrics.staking_ratio || 0.65;
  if (stakingRatio > 0.70) score += 1;
  else if (stakingRatio < 0.50) score -= 1;

  const exchReserveChange = metrics.exchange_reserve_change || 0;
  if (exchReserveChange < -0.02) score += 2;
  else if (exchReserveChange < -0.01) score += 1;
  else if (exchReserveChange > 0.02) score -= 2;
  else if (exchReserveChange > 0.01) score -= 1;

  const nvt = metrics.nvt_ratio || 50;
  if (nvt < 30) score += 1;
  else if (nvt > 80) score -= 1;

  const normalized = Math.max(-10, Math.min(10, score));

  return {
    raw: score,
    normalized,
    metrics: {
      exchange_inflow: metrics.exchange_inflow || 0,
      exchange_outflow: metrics.exchange_outflow || 0,
      net_exchange_flow: netFlow,
      whale_transactions: metrics.whale_transactions_count || 0,
      whale_volume: whaleVol,
      active_addresses: metrics.active_addresses || 0,
      new_addresses: metrics.new_addresses || 0,
      staking_ratio: stakingRatio,
      exchange_reserve_change: exchReserveChange,
      nvt_ratio: nvt,
    },
  };
}
