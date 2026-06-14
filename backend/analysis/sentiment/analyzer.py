from dataclasses import dataclass, field
from typing import Dict, List
import re

from backend.utils.logger import setup_logger

logger = setup_logger("sentiment_analyzer")

CRYPTO_LEXICON = {
    "moon": 0.8, "bullish": 0.7, "pump": 0.6, "breakout": 0.5,
    "accumulate": 0.4, "buy the dip": 0.6, "hodl": 0.3, "stake": 0.2,
    "ath": 0.6, "all time high": 0.7, "bull run": 0.8, "parabolic": 0.7,
    "dump": -0.7, "bearish": -0.6, "rekt": -0.9, "crash": -0.8,
    "rug": -0.9, "rug pull": -0.9, "scam": -0.8, "sell": -0.3,
    "fud": -0.5, "fear": -0.4, "panic": -0.7, "capitulation": -0.6,
    "fomo": 0.5, "euphoria": 0.6, "top signal": -0.7, "distribution": -0.4,
    "whale": 0.2, "adoption": 0.5, "partnership": 0.4, "upgrade": 0.3,
    "solana": 0.0, "sol": 0.0, "sol/usdt": 0.0,
}


@dataclass
class SentimentScore:
    compound: float = 0.0
    positive: float = 0.0
    negative: float = 0.0
    neutral: float = 0.0
    emotion: str = "NEUTRAL"


@dataclass
class AggregateSentiment:
    score: float = 0.0
    classification: str = "NEUTRAL"
    contrarian_signal: int = 0
    breakdown: Dict = field(default_factory=dict)


class SentimentAnalyzer:
    def __init__(self):
        self.name = "SentimentAnalyzer"

    def _simple_sentiment(self, text: str) -> SentimentScore:
        text_lower = text.lower()
        words = re.findall(r'\b\w+\b', text_lower)
        text_joined = " ".join(words)

        pos_score = 0.0
        neg_score = 0.0

        for term, value in CRYPTO_LEXICON.items():
            if term in text_joined:
                if value > 0:
                    pos_score += value
                elif value < 0:
                    neg_score += abs(value)

        total = pos_score + neg_score
        if total == 0:
            return SentimentScore(compound=0.0, positive=0.0, negative=0.0, neutral=1.0, emotion="NEUTRAL")

        compound = (pos_score - neg_score) / total

        if compound > 0.3:
            emotion = "OPTIMISM"
        elif compound > 0.6:
            emotion = "EUFORIA"
        elif compound < -0.3:
            emotion = "PESSIMISM"
        elif compound < -0.6:
            emotion = "PANIC"
        else:
            emotion = "NEUTRAL"

        fomo_terms = ["fomo", "cant miss", "last chance", "going to moon", "100x", "buy now"]
        panic_terms = ["crash", "scam", "rug", "getting out", "sell everything", "over"]

        if any(t in text_lower for t in fomo_terms):
            emotion = "FOMO"
        if any(t in text_lower for t in panic_terms):
            emotion = "PANIC"

        return SentimentScore(
            compound=compound,
            positive=pos_score / max(total, 1),
            negative=neg_score / max(total, 1),
            neutral=1.0 - (pos_score + neg_score) / max(total + 1, 1),
            emotion=emotion,
        )

    def analyze_texts(self, texts: List[str]) -> SentimentScore:
        if not texts:
            return SentimentScore()

        scores = [self._simple_sentiment(t) for t in texts]
        avg_compound = sum(s.compound for s in scores) / len(scores)
        avg_positive = sum(s.positive for s in scores) / len(scores)
        avg_negative = sum(s.negative for s in scores) / len(scores)

        emotion_counts = {}
        for s in scores:
            emotion_counts[s.emotion] = emotion_counts.get(s.emotion, 0) + 1
        dominant_emotion = max(emotion_counts, key=emotion_counts.get) if emotion_counts else "NEUTRAL"

        return SentimentScore(
            compound=avg_compound,
            positive=avg_positive,
            negative=avg_negative,
            neutral=1.0 - avg_positive - avg_negative,
            emotion=dominant_emotion,
        )

    def aggregate(self, source_scores: Dict[str, float], fear_greed: int = 50) -> AggregateSentiment:
        weights = {
            "reddit": 0.3,
            "twitter": 0.3,
            "fear_greed": 0.25,
            "news": 0.15,
        }

        weighted_score = 0.0
        total_weight = 0.0

        for source, score in source_scores.items():
            w = weights.get(source, 0.1)
            weighted_score += score * w
            total_weight += w

        if total_weight > 0:
            weighted_score /= total_weight

        fg_adjusted = (fear_greed - 50) / 50.0
        weighted_score = weighted_score * 0.7 + fg_adjusted * 0.3

        if weighted_score > 0.6:
            classification = "EXTREME_GREED"
            contrarian = -1
        elif weighted_score > 0.3:
            classification = "GREED"
            contrarian = 0
        elif weighted_score < -0.6:
            classification = "EXTREME_FEAR"
            contrarian = 1
        elif weighted_score < -0.3:
            classification = "FEAR"
            contrarian = 0
        else:
            classification = "NEUTRAL"
            contrarian = 0

        normalized = max(-10.0, min(10.0, weighted_score * 10))

        return AggregateSentiment(
            score=normalized,
            classification=classification,
            contrarian_signal=contrarian,
            breakdown=source_scores,
        )
