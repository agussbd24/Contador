from datetime import datetime, timezone
from typing import Optional


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def format_price(price: float) -> str:
    if price >= 1000:
        return f"{price:,.2f}"
    elif price >= 1:
        return f"{price:.4f}"
    else:
        return f"{price:.6f}"


def format_percentage(value: float) -> str:
    return f"{value:+.2f}%"


def format_volume(volume: float) -> str:
    if volume >= 1_000_000:
        return f"{volume / 1_000_000:.2f}M"
    elif volume >= 1_000:
        return f"{volume / 1_000:.2f}K"
    return f"{volume:.2f}"


def clamp(value: float, min_val: float, max_val: float) -> float:
    return max(min_val, min(max_val, value))
