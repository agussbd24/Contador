import numpy as np
from backend.analysis.technical.indicators import TechnicalAnalyzer
from backend.analysis.onchain.analyzer import OnChainAnalyzer
from backend.analysis.sentiment.analyzer import SentimentAnalyzer
from backend.scoring.scorer import ScoringEngine, Signal
from backend.scoring.risk_manager import RiskManager
from backend.scoring.filters import FalseSignalFilter
from backend.ml.model import MLModel, FEATURES
from backend.utils.logger import setup_logger

logger = setup_logger("pipeline")


class AnalysisPipeline:
    def __init__(self):
        self.technical = TechnicalAnalyzer()
        self.onchain = OnChainAnalyzer()
        self.sentiment = SentimentAnalyzer()
        self.scorer = ScoringEngine()
        self.risk_manager = RiskManager()
        self.filters = FalseSignalFilter()
        self.ml_model = MLModel()

    async def run(
        self,
        klines_4h: list,
        klines_1h: list,
        klines_1d: list,
        ticker: dict,
        onchain_data: dict,
        sentiment_data: dict,
        fear_greed: int,
    ) -> dict:
        # Technical analysis
        tech_score = self.technical.analyze(klines_4h)
        tech_score_1h = self.technical.analyze(klines_1h) if len(klines_1h) > 50 else None
        tech_score_1d = self.technical.analyze(klines_1d) if len(klines_1d) > 50 else None

        # On-chain analysis
        onchain_score = self.onchain.analyze(onchain_data)

        # Sentiment analysis
        sentiment_score = self.sentiment.aggregate(sentiment_data, fear_greed)

        # Fundamental score (simplified)
        fundamental_score = 0.0
        market_cap = ticker.get("quote_volume_24h", 0)
        if market_cap > 1_000_000_000:
            fundamental_score += 2

        # Risk score (10 = lowest risk)
        risk_score = 7.0
        if ticker.get("change_24h", 0) < -10:
            risk_score -= 2
        if fear_greed < 20:
            risk_score -= 1

        # ATR for risk levels
        atr = tech_score.indicators.get("atr", 0)
        current_price = ticker.get("price", 0)

        # ML prediction
        ml_prediction = 0
        ml_confidence = 0.5
        if self.ml_model.is_loaded:
            try:
                features = self._build_ml_features(
                    klines_4h, ticker, tech_score, fear_greed, onchain_data
                )
                ml_prediction, ml_confidence = self.ml_model.predict(features)
            except Exception as e:
                logger.warning(f"ML prediction failed: {e}")

        # Scoring
        signal = self.scorer.calculate(
            technical_score=tech_score.normalized,
            onchain_score=onchain_score.normalized,
            sentiment_score=sentiment_score.score,
            fundamental_score=fundamental_score,
            risk_score=risk_score,
            current_price=current_price,
            atr=atr,
        )

        # Build result
        result = {
            "signal": signal.signal,
            "confidence": signal.confidence,
            "composite_score": signal.composite_score,
            "price": current_price,
            "breakdown": signal.breakdown,
            "risk_levels": signal.risk_levels,
            "filter_reasons": [],
            "filters_applied": False,
            "technical": {
                "score": tech_score.normalized,
                "rsi": tech_score.indicators.get("rsi_14", 50),
                "macd": tech_score.indicators.get("macd", 0),
                "macd_signal": tech_score.indicators.get("macd_signal", 0),
                "bb_width": tech_score.indicators.get("bb_width", 0),
                "volume_ratio": tech_score.indicators.get("volume_ratio", 1),
                "order_blocks": tech_score.indicators.get("order_blocks", {}),
                "liquidity": tech_score.indicators.get("liquidity", {}),
            },
            "onchain": {
                "score": onchain_score.normalized,
                "metrics": onchain_score.metrics,
            },
            "sentiment": {
                "score": sentiment_score.score,
                "classification": sentiment_score.classification,
                "breakdown": sentiment_score.breakdown,
            },
            "ml": {
                "prediction": ml_prediction,
                "confidence": ml_confidence,
                "version": self.ml_model.version,
            },
            "fear_greed": fear_greed,
        }

        # Apply filters
        market_data = {
            "price": current_price,
            "high_24h": ticker.get("high_24h", current_price),
            "low_24h": ticker.get("low_24h", current_price),
            "volume_ratio": tech_score.indicators.get("volume_ratio", 1),
            "fear_greed": fear_greed,
            "multi_timeframe_confirmed": self._check_multi_timeframe(
                tech_score, tech_score_1h, tech_score_1d
            ),
        }
        result = self.filters.apply(result, market_data)

        # Risk validation
        result = self.risk_manager.validate_signal(result)

        return result

    def _check_multi_timeframe(self, tech_4h, tech_1h, tech_1d) -> bool:
        if tech_1h is None or tech_1d is None:
            return True

        primary_direction = 1 if tech_4h.normalized > 0 else -1
        confirm_1h = 1 if tech_1h.normalized > 0 else -1
        confirm_1d = 1 if tech_1d.normalized > 0 else -1

        return primary_direction == confirm_1h or primary_direction == confirm_1d

    def _build_ml_features(self, klines, ticker, tech_score, fear_greed, onchain_data):
        if len(klines) < 2:
            return np.zeros(len(FEATURES))

        latest = klines[-1]
        prev = klines[-2] if len(klines) > 1 else latest

        price_change_1h = (latest["close"] - prev["close"]) / prev["close"] if prev["close"] > 0 else 0
        price_change_4h = price_change_1h

        closes = [k["close"] for k in klines[-24:]]
        price_change_24h = (closes[-1] - closes[0]) / closes[0] if closes[0] > 0 else 0

        highs = [k["high"] for k in klines[-24:]]
        lows = [k["low"] for k in klines[-24:]]
        volatility_24h = (max(highs) - min(lows)) / closes[-1] if closes[-1] > 0 else 0

        volumes = [k["volume"] for k in klines[-24:]]
        volume_change_1h = volumes[-1] / volumes[-2] if len(volumes) > 1 and volumes[-2] > 0 else 1

        indicators = tech_score.indicators

        features = np.array([
            latest["close"],
            latest["open"],
            latest["high"],
            latest["low"],
            latest["volume"],
            price_change_1h,
            price_change_4h,
            price_change_24h,
            volatility_24h,
            volume_change_1h,
            indicators.get("rsi_14", 50),
            indicators.get("rsi_14", 50),
            indicators.get("macd", 0),
            indicators.get("macd_signal", 0),
            indicators.get("macd_histogram", 0),
            indicators.get("ema_9", latest["close"]),
            indicators.get("ema_21", latest["close"]),
            indicators.get("ema_50", latest["close"]),
            indicators.get("bb_upper", latest["close"]),
            indicators.get("bb_middle", latest["close"]),
            indicators.get("bb_lower", latest["close"]),
            indicators.get("bb_width", 0),
            indicators.get("atr", 0),
            25.0,
            50.0,
            50.0,
            indicators.get("vwap", latest["close"]),
            1.0 if indicators.get("obv_trend") == "up" else -1.0,
            fear_greed,
            0.0,
            onchain_data.get("net_exchange_flow", 0),
            onchain_data.get("whale_volume_sol", 0),
            indicators.get("volume_ratio", 1),
            0.0,
        ], dtype=float)

        if len(features) < len(FEATURES):
            features = np.pad(features, (0, len(FEATURES) - len(features)))
        elif len(features) > len(FEATURES):
            features = features[:len(FEATURES)]

        return features
