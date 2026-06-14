from backend.utils.logger import setup_logger

logger = setup_logger("filters")


class FalseSignalFilter:
    def __init__(self):
        self.name = "FalseSignalFilter"

    def apply(self, signal_data: dict, market_data: dict) -> dict:
        confidence = signal_data.get("confidence", 0)
        reasons = signal_data.get("filter_reasons", [])
        signal_type = signal_data.get("signal", "HOLD")

        if signal_type == "HOLD":
            return signal_data

        range_24h = 0
        high_24h = market_data.get("high_24h", 0)
        low_24h = market_data.get("low_24h", 0)
        close_price = market_data.get("price", 1)
        if close_price > 0:
            range_24h = (high_24h - low_24h) / close_price

        if range_24h < 0.02:
            confidence -= 30
            reasons.append("RANGE_BOUND")

        volume_ratio = market_data.get("volume_ratio", 1.0)
        if volume_ratio < 0.5:
            confidence -= 25
            reasons.append("LOW_VOLUME")

        if market_data.get("major_news_detected", False):
            confidence -= 50
            reasons.append("NEWS_EVENT")

        if market_data.get("whale_manipulation_detected", False):
            confidence -= 40
            reasons.append("WHALE_MANIPULATION")

        fear_greed = market_data.get("fear_greed", 50)
        if fear_greed > 90 or fear_greed < 10:
            confidence -= 20
            reasons.append("EXTREME_SENTIMENT")

        multi_tf = market_data.get("multi_timeframe_confirmed", True)
        if not multi_tf:
            confidence -= 15
            reasons.append("NO_MULTI_TIMEFRAME")

        signal_data["confidence"] = max(0, confidence)
        signal_data["filter_reasons"] = reasons
        signal_data["filters_applied"] = len(reasons) > 0

        if signal_data["confidence"] < 30:
            signal_data["signal"] = "HOLD"
            signal_data["confidence"] = 0
            logger.info(f"Signal killed by filters: {reasons}")

        return signal_data
