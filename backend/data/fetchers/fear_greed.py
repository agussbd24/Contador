import ssl
import aiohttp
from typing import Optional

from backend.config import FEAR_GREED_URL
from backend.utils.logger import setup_logger

logger = setup_logger("fear_greed_fetcher")

SSL_CONTEXT = ssl.create_default_context()
SSL_CONTEXT.check_hostname = False
SSL_CONTEXT.verify_mode = ssl.CERT_NONE


class FearGreedFetcher:
    def __init__(self):
        self.session: Optional[aiohttp.ClientSession] = None

    async def _get_session(self) -> aiohttp.ClientSession:
        if self.session is None or self.session.closed:
            connector = aiohttp.TCPConnector(ssl=SSL_CONTEXT)
            self.session = aiohttp.ClientSession(connector=connector)
        return self.session

    async def get_current(self) -> dict:
        session = await self._get_session()
        params = {"limit": 1}

        try:
            async with session.get(FEAR_GREED_URL, params=params) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    if data.get("data"):
                        entry = data["data"][0]
                        return {
                            "value": int(entry["value"]),
                            "classification": entry["value_classification"],
                            "timestamp": entry["timestamp"],
                        }
                return {"value": 50, "classification": "Neutral", "timestamp": ""}
        except Exception as e:
            logger.error(f"Fear & Greed exception: {e}")
            return {"value": 50, "classification": "Neutral", "timestamp": ""}

    async def get_history(self, days: int = 30) -> list:
        session = await self._get_session()
        params = {"limit": days}

        try:
            async with session.get(FEAR_GREED_URL, params=params) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    return [
                        {
                            "value": int(entry["value"]),
                            "classification": entry["value_classification"],
                            "timestamp": entry["timestamp"],
                        }
                        for entry in data.get("data", [])
                    ]
                return []
        except Exception as e:
            logger.error(f"Fear & Greed history exception: {e}")
            return []

    async def close(self):
        if self.session and not self.session.closed:
            await self.session.close()
