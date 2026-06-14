from dataclasses import dataclass, field
from typing import Dict
from backend.utils.logger import setup_logger

logger = setup_logger("onchain_analyzer")


@dataclass
class OnChainScore:
    raw: float = 0.0
    normalized: float = 0.0
    metrics: Dict = field(default_factory=dict)


class OnChainAnalyzer:
    WHALE_THRESHOLDS = {
        "large_transfer_sol": 10000,
        "exchange_inflow": 50000,
        "exchange_outflow": 50000,
    }

    def __init__(self):
        self.name = "OnChainAnalyzer"

    def analyze(self, metrics: dict) -> OnChainScore:
        score = 0.0

        exchange_inflow = metrics.get("exchange_inflow", 0)
        exchange_outflow = metrics.get("exchange_outflow", 0)
        net_flow = exchange_outflow - exchange_inflow

        if net_flow > 5000:
            score += 2
        elif net_flow > 1000:
            score += 1
        elif net_flow < -5000:
            score -= 2
        elif net_flow < -1000:
            score -= 1

        whale_count = metrics.get("whale_transactions_count", 0)
        whale_volume = metrics.get("whale_volume_sol", 0)

        if whale_volume > 100000:
            score += 2
        elif whale_volume > 50000:
            score += 1
        elif whale_volume < -100000:
            score -= 2

        active_addresses = metrics.get("active_addresses", 0)
        new_addresses = metrics.get("new_addresses", 0)

        if active_addresses > 1000000:
            score += 1
        if new_addresses > 50000:
            score += 1
        elif new_addresses < 10000:
            score -= 0.5

        staking_ratio = metrics.get("staking_ratio", 0.65)
        if staking_ratio > 0.70:
            score += 1
        elif staking_ratio < 0.50:
            score -= 1

        exchange_reserve_change = metrics.get("exchange_reserve_change", 0)
        if exchange_reserve_change < -0.02:
            score += 2
        elif exchange_reserve_change < -0.01:
            score += 1
        elif exchange_reserve_change > 0.02:
            score -= 2
        elif exchange_reserve_change > 0.01:
            score -= 1

        nvt = metrics.get("nvt_ratio", 50)
        if nvt < 30:
            score += 1
        elif nvt > 80:
            score -= 1

        sol_staked = metrics.get("sol_staked", 0)
        total_supply = metrics.get("total_supply", 400000000)
        if total_supply > 0:
            staked_pct = sol_staked / total_supply
            if staked_pct > 0.65:
                score += 1

        normalized = max(-10.0, min(10.0, score))

        return OnChainScore(
            raw=score,
            normalized=normalized,
            metrics={
                "exchange_inflow": exchange_inflow,
                "exchange_outflow": exchange_outflow,
                "net_exchange_flow": net_flow,
                "whale_transactions": whale_count,
                "whale_volume": whale_volume,
                "active_addresses": active_addresses,
                "new_addresses": new_addresses,
                "staking_ratio": staking_ratio,
                "exchange_reserve_change": exchange_reserve_change,
                "nvt_ratio": nvt,
            },
        )
