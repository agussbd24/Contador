import numpy as np
from typing import Dict, List, Optional
from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class TechnicalScore:
    raw: float = 0.0
    normalized: float = 0.0
    indicators: Dict = field(default_factory=dict)


class TechnicalAnalyzer:
    def __init__(self):
        self.name = "TechnicalAnalyzer"

    def analyze(self, klines: list) -> TechnicalScore:
        if len(klines) < 50:
            return TechnicalScore(raw=0, normalized=0, indicators={})

        closes = np.array([k["close"] for k in klines], dtype=float)
        highs = np.array([k["high"] for k in klines], dtype=float)
        lows = np.array([k["low"] for k in klines], dtype=float)
        volumes = np.array([k["volume"] for k in klines], dtype=float)

        indicators = {}
        score = 0.0

        # RSI
        rsi = self._calc_rsi(closes, 14)
        indicators["rsi_14"] = float(rsi[-1]) if len(rsi) > 0 else 50.0
        if indicators["rsi_14"] < 30:
            score += 2
        elif indicators["rsi_14"] < 40:
            score += 1
        elif indicators["rsi_14"] > 70:
            score -= 2
        elif indicators["rsi_14"] > 60:
            score -= 1

        # MACD
        macd_line, signal_line, histogram = self._calc_macd(closes)
        indicators["macd"] = float(macd_line[-1]) if len(macd_line) > 0 else 0.0
        indicators["macd_signal"] = float(signal_line[-1]) if len(signal_line) > 0 else 0.0
        indicators["macd_histogram"] = float(histogram[-1]) if len(histogram) > 0 else 0.0
        if len(macd_line) > 1 and len(signal_line) > 1:
            if macd_line[-1] > signal_line[-1] and macd_line[-2] <= signal_line[-2]:
                score += 2
            elif macd_line[-1] < signal_line[-1] and macd_line[-2] >= signal_line[-2]:
                score -= 2
            if histogram[-1] > 0:
                score += 0.5
            else:
                score -= 0.5

        # EMA Ribbon
        ema_9 = self._calc_ema(closes, 9)
        ema_21 = self._calc_ema(closes, 21)
        ema_50 = self._calc_ema(closes, 50)
        indicators["ema_9"] = float(ema_9[-1]) if len(ema_9) > 0 else closes[-1]
        indicators["ema_21"] = float(ema_21[-1]) if len(ema_21) > 0 else closes[-1]
        indicators["ema_50"] = float(ema_50[-1]) if len(ema_50) > 0 else closes[-1]

        if len(ema_9) > 0 and len(ema_21) > 0 and len(ema_50) > 0:
            if ema_9[-1] > ema_21[-1] > ema_50[-1]:
                score += 3
            elif ema_9[-1] < ema_21[-1] < ema_50[-1]:
                score -= 3
            elif ema_9[-1] > ema_21[-1]:
                score += 1
            elif ema_9[-1] < ema_21[-1]:
                score -= 1

        # Bollinger Bands
        bb_upper, bb_middle, bb_lower = self._calc_bollinger(closes, 20, 2)
        indicators["bb_upper"] = float(bb_upper[-1]) if len(bb_upper) > 0 else closes[-1]
        indicators["bb_middle"] = float(bb_middle[-1]) if len(bb_middle) > 0 else closes[-1]
        indicators["bb_lower"] = float(bb_lower[-1]) if len(bb_lower) > 0 else closes[-1]

        if len(bb_upper) > 0:
            bb_width = (bb_upper[-1] - bb_lower[-1]) / bb_middle[-1] if bb_middle[-1] > 0 else 0
            indicators["bb_width"] = float(bb_width)
            if bb_width < 0.005:
                score += 0.5
            if closes[-1] < bb_lower[-1]:
                score += 1.5
            elif closes[-1] > bb_upper[-1]:
                score -= 1.5

        # ATR
        atr = self._calc_atr(highs, lows, closes, 14)
        indicators["atr"] = float(atr[-1]) if len(atr) > 0 else 0.0

        # VWAP
        vwap = self._calc_vwap(highs, lows, closes, volumes)
        indicators["vwap"] = float(vwap) if vwap else closes[-1]
        if closes[-1] > vwap:
            score += 1
        else:
            score -= 1

        # OBV
        obv = self._calc_obv(closes, volumes)
        indicators["obv_trend"] = "up" if len(obv) > 5 and obv[-1] > obv[-5] else "down"
        if len(obv) > 5 and obv[-1] > obv[-5]:
            score += 1
        elif len(obv) > 5 and obv[-1] < obv[-5]:
            score -= 1

        # Volume analysis
        vol_avg = np.mean(volumes[-20:]) if len(volumes) >= 20 else np.mean(volumes)
        indicators["volume_ratio"] = float(volumes[-1] / vol_avg) if vol_avg > 0 else 1.0
        if indicators["volume_ratio"] > 2.0:
            if closes[-1] > closes[-2]:
                score += 2
            else:
                score -= 2
        elif indicators["volume_ratio"] > 1.5:
            if closes[-1] > closes[-2]:
                score += 1
            else:
                score -= 1

        # RSI Divergence
        if len(closes) > 30 and len(closes[-30:]) >= 10:
            price_lows = closes[-30:]
            rsi_vals = self._calc_rsi(closes, 14)[-30:]
            if len(rsi_vals) >= 10:
                if price_lows[-1] < price_lows[-10] and rsi_vals[-1] > rsi_vals[-10]:
                    score += 1
                    indicators["bullish_divergence"] = True
                elif price_lows[-1] > price_lows[-10] and rsi_vals[-1] < rsi_vals[-10]:
                    score -= 1
                    indicators["bearish_divergence"] = True

        # Order Blocks (simplified)
        indicators["order_blocks"] = self._detect_order_blocks(closes, highs, lows)
        if indicators["order_blocks"].get("bullish_ob_break"):
            score += 2
        if indicators["order_blocks"].get("bearish_ob_break"):
            score -= 2

        # Liquidity Sweeps
        indicators["liquidity"] = self._detect_liquidity_sweeps(closes, highs, lows)
        if indicators["liquidity"].get("bullish_sweep"):
            score += 2
        if indicators["liquidity"].get("bearish_sweep"):
            score -= 2

        normalized = max(-10.0, min(10.0, score))
        indicators["raw_score"] = score

        return TechnicalScore(raw=score, normalized=normalized, indicators=indicators)

    def _calc_rsi(self, closes: np.ndarray, period: int = 14) -> np.ndarray:
        deltas = np.diff(closes)
        gains = np.where(deltas > 0, deltas, 0)
        losses = np.where(deltas < 0, -deltas, 0)

        if len(gains) < period:
            return np.array([50.0])

        avg_gain = np.mean(gains[:period])
        avg_loss = np.mean(losses[:period])

        rsi_values = np.zeros(len(deltas))
        rsi_values[:period] = 50.0

        for i in range(period, len(deltas)):
            avg_gain = (avg_gain * (period - 1) + gains[i]) / period
            avg_loss = (avg_loss * (period - 1) + losses[i]) / period
            if avg_loss == 0:
                rsi_values[i] = 100.0
            else:
                rs = avg_gain / avg_loss
                rsi_values[i] = 100.0 - (100.0 / (1.0 + rs))

        return rsi_values

    def _calc_ema(self, data: np.ndarray, period: int) -> np.ndarray:
        if len(data) < period:
            return data.copy()
        multiplier = 2 / (period + 1)
        ema = np.zeros(len(data))
        ema[:period] = np.mean(data[:period])
        for i in range(period, len(data)):
            ema[i] = (data[i] - ema[i - 1]) * multiplier + ema[i - 1]
        return ema

    def _calc_macd(self, closes: np.ndarray, fast: int = 12, slow: int = 26, signal: int = 9):
        ema_fast = self._calc_ema(closes, fast)
        ema_slow = self._calc_ema(closes, slow)
        macd_line = ema_fast - ema_slow
        signal_line = self._calc_ema(macd_line, signal)
        histogram = macd_line - signal_line
        return macd_line, signal_line, histogram

    def _calc_bollinger(self, closes: np.ndarray, period: int = 20, std_dev: float = 2.0):
        if len(closes) < period:
            return closes, closes, closes
        middle = np.convolve(closes, np.ones(period) / period, mode="valid")
        std = np.array([np.std(closes[i:i + period]) for i in range(len(closes) - period + 1)])
        upper = middle + std_dev * std
        lower = middle - std_dev * std
        return upper, middle, lower

    def _calc_atr(self, highs: np.ndarray, lows: np.ndarray, closes: np.ndarray, period: int = 14) -> np.ndarray:
        tr = np.maximum(
            highs[1:] - lows[1:],
            np.maximum(
                np.abs(highs[1:] - closes[:-1]),
                np.abs(lows[1:] - closes[:-1])
            )
        )
        atr = np.zeros(len(tr))
        if len(tr) >= period:
            atr[:period] = np.mean(tr[:period])
            for i in range(period, len(tr)):
                atr[i] = (atr[i - 1] * (period - 1) + tr[i]) / period
        return atr

    def _calc_vwap(self, highs: np.ndarray, lows: np.ndarray, closes: np.ndarray, volumes: np.ndarray) -> float:
        typical_price = (highs + lows + closes) / 3
        cumulative_tpv = np.sum(typical_price * volumes)
        cumulative_volume = np.sum(volumes)
        if cumulative_volume > 0:
            return float(cumulative_tpv / cumulative_volume)
        return float(closes[-1])

    def _calc_obv(self, closes: np.ndarray, volumes: np.ndarray) -> np.ndarray:
        obv = np.zeros(len(closes))
        for i in range(1, len(closes)):
            if closes[i] > closes[i - 1]:
                obv[i] = obv[i - 1] + volumes[i]
            elif closes[i] < closes[i - 1]:
                obv[i] = obv[i - 1] - volumes[i]
            else:
                obv[i] = obv[i - 1]
        return obv

    def _detect_order_blocks(self, closes: np.ndarray, highs: np.ndarray, lows: np.ndarray) -> dict:
        result = {"bullish_ob_break": False, "bearish_ob_break": False}
        if len(closes) < 20:
            return result

        recent = closes[-20:]
        min_idx = np.argmin(recent[:-5])
        max_idx = np.argmax(recent[:-5])

        if min_idx < len(recent) - 5:
            ob_low = recent[min_idx]
            if closes[-1] > ob_low * 1.01 and closes[-2] <= ob_low * 1.01:
                result["bullish_ob_break"] = True
                result["bullish_ob_level"] = float(ob_low)

        if max_idx < len(recent) - 5:
            ob_high = recent[max_idx]
            if closes[-1] < ob_high * 0.99 and closes[-2] >= ob_high * 0.99:
                result["bearish_ob_break"] = True
                result["bearish_ob_level"] = float(ob_high)

        return result

    def _detect_liquidity_sweeps(self, closes: np.ndarray, highs: np.ndarray, lows: np.ndarray) -> dict:
        result = {"bullish_sweep": False, "bearish_sweep": False}
        if len(closes) < 30:
            return result

        recent_lows = lows[-30:-5]
        recent_highs = highs[-30:-5]

        lowest = np.min(recent_lows)
        highest = np.max(recent_highs)

        if lows[-1] < lowest and closes[-1] > lowest:
            result["bullish_sweep"] = True
            result["sweep_level"] = float(lowest)

        if highs[-1] > highest and closes[-1] < highest:
            result["bearish_sweep"] = True
            result["sweep_level"] = float(highest)

        return result
