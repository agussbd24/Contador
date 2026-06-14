from backend.config import MIN_RR_RATIO, RISK_PER_TRADE
from backend.utils.logger import setup_logger

logger = setup_logger("risk_manager")


class RiskManager:
    def __init__(self):
        self.name = "RiskManager"

    def validate_signal(self, signal_data: dict) -> dict:
        risk_levels = signal_data.get("risk_levels", {})

        rr_ratio = risk_levels.get("rr_ratio", 0)
        if rr_ratio < MIN_RR_RATIO and signal_data.get("signal") != "HOLD":
            signal_data["filter_reasons"] = signal_data.get("filter_reasons", [])
            signal_data["filter_reasons"].append(f"LOW_RR_{rr_ratio}")
            signal_data["confidence"] = max(0, signal_data.get("confidence", 0) - 20)
            logger.warning(f"Signal penalized: RR ratio {rr_ratio} < {MIN_RR_RATIO}")

        risk_pct = risk_levels.get("risk_pct", 0)
        if risk_pct > 5.0:
            signal_data["filter_reasons"] = signal_data.get("filter_reasons", [])
            signal_data["filter_reasons"].append(f"HIGH_RISK_{risk_pct}%")
            signal_data["confidence"] = max(0, signal_data.get("confidence", 0) - 15)

        return signal_data

    def calculate_position_size(self, portfolio_value: float, risk_pct: float, entry: float, stop_loss: float) -> float:
        if entry <= 0 or stop_loss <= 0 or entry == stop_loss:
            return 0
        risk_amount = portfolio_value * (risk_pct / 100)
        price_risk = abs(entry - stop_loss)
        if price_risk > 0:
            return risk_amount / price_risk
        return 0

    def calculate_stop_loss(self, entry_price: float, atr: float, direction: str) -> float:
        multiplier = 2.0
        if direction == "BUY":
            return entry_price - (atr * multiplier)
        else:
            return entry_price + (atr * multiplier)

    def calculate_take_profit(self, entry_price: float, atr: float, direction: str) -> float:
        multiplier = 3.0
        if direction == "BUY":
            return entry_price + (atr * multiplier)
        else:
            return entry_price - (atr * multiplier)
