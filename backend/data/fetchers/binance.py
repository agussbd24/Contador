import asyncio
import json
import random
import ssl
import time
from typing import Optional
from datetime import datetime, timezone, timedelta

import aiohttp

from backend.config import BINANCE_WS_URL, BINANCE_REST_URL, SYMBOL, HTTP_PROXY, HTTPS_PROXY, MOCK_DATA
from backend.utils.logger import setup_logger

logger = setup_logger("binance_fetcher")

SSL_CONTEXT = ssl.create_default_context()
SSL_CONTEXT.check_hostname = False
SSL_CONTEXT.verify_mode = ssl.CERT_NONE


def _generate_mock_klines(interval: str, limit: int) -> list:
    base_price = 142.0
    interval_seconds = {"5m": 300, "15m": 900, "1h": 3600, "4h": 14400, "1d": 86400}
    seconds = interval_seconds.get(interval, 3600)
    now = datetime.now(timezone.utc)

    klines = []
    price = base_price
    for i in range(limit):
        t = now - timedelta(seconds=seconds * (limit - i))
        change = random.uniform(-0.02, 0.02)
        open_p = price
        close_p = price * (1 + change)
        high_p = max(open_p, close_p) * (1 + random.uniform(0, 0.005))
        low_p = min(open_p, close_p) * (1 - random.uniform(0, 0.005))
        volume = random.uniform(50000, 500000)
        klines.append({
            "time": t,
            "open": round(open_p, 4),
            "high": round(high_p, 4),
            "low": round(low_p, 4),
            "close": round(close_p, 4),
            "volume": round(volume, 2),
            "trades": random.randint(1000, 50000),
        })
        price = close_p
    return klines


def _generate_mock_ticker() -> dict:
    price = 142.0 + random.uniform(-5, 5)
    return {
        "symbol": "SOLUSDT",
        "price": round(price, 2),
        "change_24h": round(random.uniform(-5, 5), 2),
        "high_24h": round(price * 1.03, 2),
        "low_24h": round(price * 0.97, 2),
        "volume_24h": round(random.uniform(500_000_000, 2_000_000_000), 2),
        "quote_volume_24h": round(random.uniform(500_000_000, 2_000_000_000), 2),
    }


class BinanceFetcher:
    def __init__(self):
        self.session: Optional[aiohttp.ClientSession] = None
        self.ws_connection = None
        self.latest_price = None
        self.latest_klines = {}
        self._callbacks = []
        self._mock_mode = MOCK_DATA

    async def _get_session(self) -> aiohttp.ClientSession:
        if self.session is None or self.session.closed:
            connector = aiohttp.TCPConnector(ssl=SSL_CONTEXT)
            self.session = aiohttp.ClientSession(connector=connector)
        return self.session

    def on_price_update(self, callback):
        self._callbacks.append(callback)

    async def get_klines(self, symbol: str = SYMBOL, interval: str = "4h", limit: int = 500) -> list:
        if self._mock_mode:
            return _generate_mock_klines(interval, limit)

        session = await self._get_session()
        url = f"{BINANCE_REST_URL}/klines"
        params = {"symbol": symbol, "interval": interval, "limit": limit}

        try:
            async with session.get(url, params=params, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    return [
                        {
                            "time": datetime.fromtimestamp(k[0] / 1000, tz=timezone.utc),
                            "open": float(k[1]),
                            "high": float(k[2]),
                            "low": float(k[3]),
                            "close": float(k[4]),
                            "volume": float(k[5]),
                            "trades": int(k[8]),
                        }
                        for k in data
                    ]
                else:
                    logger.warning(f"Binance klines HTTP {resp.status}, falling back to mock")
                    return _generate_mock_klines(interval, limit)
        except Exception as e:
            logger.warning(f"Binance klines error: {e}, using mock data")
            return _generate_mock_klines(interval, limit)

    async def get_ticker(self, symbol: str = SYMBOL) -> dict:
        if self._mock_mode:
            return _generate_mock_ticker()

        session = await self._get_session()
        url = f"{BINANCE_REST_URL}/ticker/24hr"
        params = {"symbol": symbol}

        try:
            async with session.get(url, params=params, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    return {
                        "symbol": data["symbol"],
                        "price": float(data["lastPrice"]),
                        "change_24h": float(data["priceChangePercent"]),
                        "high_24h": float(data["highPrice"]),
                        "low_24h": float(data["lowPrice"]),
                        "volume_24h": float(data["volume"]),
                        "quote_volume_24h": float(data["quoteVolume"]),
                    }
                else:
                    logger.warning(f"Binance ticker HTTP {resp.status}, using mock")
                    return _generate_mock_ticker()
        except Exception as e:
            logger.warning(f"Binance ticker error: {e}, using mock data")
            return _generate_mock_ticker()

    async def get_orderbook(self, symbol: str = SYMBOL, limit: int = 20) -> dict:
        if self._mock_mode:
            price = self.latest_price or 142.0
            return {
                "bids": [(price - i * 0.01, random.uniform(1, 100)) for i in range(limit)],
                "asks": [(price + i * 0.01, random.uniform(1, 100)) for i in range(limit)],
            }

        session = await self._get_session()
        url = f"{BINANCE_REST_URL}/depth"
        params = {"symbol": symbol, "limit": limit}

        try:
            async with session.get(url, params=params, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    bids = [(float(p), float(q)) for p, q in data["bids"]]
                    asks = [(float(p), float(q)) for p, q in data["asks"]]
                    return {"bids": bids, "asks": asks}
                return {"bids": [], "asks": []}
        except Exception as e:
            logger.error(f"Binance orderbook exception: {e}")
            return {"bids": [], "asks": []}

    async def get_all_klines_multi_tf(self, symbol: str = SYMBOL) -> dict:
        tasks = {
            "5m": self.get_klines(symbol, "5m", 500),
            "15m": self.get_klines(symbol, "15m", 500),
            "1h": self.get_klines(symbol, "1h", 500),
            "4h": self.get_klines(symbol, "4h", 500),
            "1d": self.get_klines(symbol, "1d", 500),
        }
        results = {}
        for tf, task in tasks.items():
            results[tf] = await task
        return results

    async def close(self):
        if self.session and not self.session.closed:
            await self.session.close()
        if self.ws_connection:
            await self.ws_connection.close()
