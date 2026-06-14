import ssl
import aiohttp
from typing import Optional

from backend.config import COINGECKO_API_KEY, COINGECKO_BASE_URL
from backend.utils.logger import setup_logger

logger = setup_logger("coingecko_fetcher")

SSL_CONTEXT = ssl.create_default_context()
SSL_CONTEXT.check_hostname = False
SSL_CONTEXT.verify_mode = ssl.CERT_NONE


class CoinGeckoFetcher:
    def __init__(self):
        self.session: Optional[aiohttp.ClientSession] = None

    async def _get_session(self) -> aiohttp.ClientSession:
        if self.session is None or self.session.closed:
            connector = aiohttp.TCPConnector(ssl=SSL_CONTEXT)
            self.session = aiohttp.ClientSession(connector=connector)
        return self.session

    async def get_sol_market_data(self) -> dict:
        session = await self._get_session()
        url = f"{COINGECKO_BASE_URL}/coins/solana"
        params = {
            "localization": "false",
            "tickers": "false",
            "market_data": "true",
            "community_data": "true",
            "developer_data": "false",
        }
        headers = {}
        if COINGECKO_API_KEY:
            headers["x-cg-demo-api-key"] = COINGECKO_API_KEY

        try:
            async with session.get(url, params=params, headers=headers) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    md = data.get("market_data", {})
                    community = data.get("community_data", {})

                    return {
                        "market_cap": md.get("market_cap", {}).get("usd", 0),
                        "market_cap_rank": md.get("market_cap_rank", 0),
                        "total_volume": md.get("total_volume", {}).get("usd", 0),
                        "circulating_supply": md.get("circulating_supply", 0),
                        "total_supply": md.get("total_supply", 0),
                        "max_supply": md.get("max_supply", 0),
                        "ath": md.get("ath", {}).get("usd", 0),
                        "ath_change_pct": md.get("ath_change_percentage", {}).get("usd", 0),
                        "atl": md.get("atl", {}).get("usd", 0),
                        "price_change_24h": md.get("price_change_percentage_24h", 0),
                        "price_change_7d": md.get("price_change_percentage_7d", 0),
                        "price_change_30d": md.get("price_change_percentage_30d", 0),
                        "reddit_subscribers": community.get("reddit_subscribers", 0),
                        "reddit_active_accounts": community.get("reddit_accounts_active_48h", 0),
                    }
                else:
                    logger.warning(f"CoinGecko API returned {resp.status}")
                    return {}
        except Exception as e:
            logger.error(f"CoinGecko exception: {e}")
            return {}

    async def close(self):
        if self.session and not self.session.closed:
            await self.session.close()
