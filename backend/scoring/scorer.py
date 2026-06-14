from dataclasses import dataclass, field
from typing import Dict

from backend.config import TECHNICAL_WEIGHTS
from backend.utils.logger import setup_logger

logger = setup_logger("scorer")


@dataclass
class Signal:
    signal: str = "HOLD"
    confidence: int = 0
    composite_score: float = 0.0
    breakdown: Dict = field(default_factory=dict)
    risk_levels: Dict = field(default_factory=dict)
    filter_reasons: list = field(default_factory=list)


class ScoringEngine:
    def __init__(self):
        self.weights = TECHNICAL_WEIGHTS

    def calculate(
        self,
        technical_score: float,
        onchain_score: float,
        sentiment_score: float,
        fundamental_score: float,
        risk_score: float,
        current_price: float = 0,
        atr: float = 0,
    ) -> Signal:
        t = technical_score / 10.0
        o = onchain_score / 10.0
        s = sentiment_score / 10.0
        f = fundamental_score / 10.0
        r = risk_score / 10.0

        composite = (
            t * self.weights["technical"]
            + o * self.weights["onchain"]
            + s * self.weights["sentiment"]
            + f * self.weights["fundamental"]
            + r * self.weights["risk"]
        )

        factors = [t, o, s, f]
        mean = sum(factors) / len(factors) if factors else 0
        variance = sum((x - mean) ** 2 for x in factors) / len(factors) if factors else 0
        agreement = 1 - min(variance ** 0.5, 1.0)

        if composite > 0.5:
            signal_type = "STRONG_BUY"
        elif composite > 0.2:
            signal_type = "BUY"
        elif composite > -0.2:
            signal_type = "HOLD"
        elif composite > -0.5:
            signal_type = "SELL"
        else:
            signal_type = "STRONG_SELL"

        confidence = min(100, max(0, int(
            abs(composite) * 60
            + agreement * 30
            + 10
        )))

        risk_levels = {}
        if current_price > 0 and atr > 0:
            if signal_type in ("BUY", "STRONG_BUY"):
                stop_loss = current_price - (2 * atr)
                take_profit = current_price + (3 * atr)
            elif signal_type in ("SELL", "STRONG_SELL"):
                stop_loss = current_price + (2 * atr)
                take_profit = current_price - (3 * atr)
            else:
                stop_loss = 0
                take_profit = 0

            risk = abs(current_price - stop_loss) if stop_loss > 0 else 1
            reward = abs(take_profit - current_price) if take_profit > 0 else 0
            rr_ratio = reward / risk if risk > 0 else 0

            risk_levels = {
                "entry": current_price,
                "stop_loss": stop_loss,
                "take_profit": take_profit,
                "rr_ratio": round(rr_ratio, 2),
                "risk_pct": round(risk / current_price * 100, 2) if current_price > 0 else 0,
                "reward_pct": round(reward / current_price * 100, 2) if current_price > 0 else 0,
            }

        return Signal(
            signal=signal_type,
            confidence=confidence,
            composite_score=round(composite, 4),
            breakdown={
                "technical": round(technical_score, 2),
                "onchain": round(onchain_score, 2),
                "sentiment": round(sentiment_score, 2),
                "fundamental": round(fundamental_score, 2),
                "risk": round(risk_score, 2),
            },
            risk_levels=risk_levels,
        )
