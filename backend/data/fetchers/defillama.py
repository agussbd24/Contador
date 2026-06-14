import ssl
import aiohttp
from typing import Optional

from backend.utils.logger import setup_logger

logger = setup_logger("defillama_fetcher")

SSL_CONTEXT = ssl.create_default_context()
SSL_CONTEXT.check_hostname = False
SSL_CONTEXT.verify_mode = ssl.CERT_NONE


class DefiLlamaFetcher:
    def __init__(self):
        self.session: Optional[aiohttp.ClientSession] = None
        self.base_url = "https://api.llama.fi"

    async def _get_session(self) -> aiohttp.ClientSession:
        if self.session is None or self.session.closed:
            connector = aiohttp.TCPConnector(ssl=SSL_CONTEXT)
            self.session = aiohttp.ClientSession(connector=connector)
        return self.session

    async def get_solana_tvl(self) -> dict:
        session = await self._get_session()
        try:
            async with session.get(f"{self.base_url}/tvl/solana") as resp:
                if resp.status == 200:
                    tvl = await resp.json()
                    return {"solana_tvl": tvl}
                return {"solana_tvl": 0}
        except Exception as e:
            logger.error(f"DefiLlama TVL exception: {e}")
            return {"solana_tvl": 0}

    async def get_solana_protocols(self) -> list:
        session = await self._get_session()
        try:
            async with session.get(f"{self.base_url}/protocols") as resp:
                if resp.status == 200:
                    data = await resp.json()
                    solana_protocols = [
                        p for p in data
                        if "Solana" in p.get("chains", [])
                    ]
                    return [
                        {
                            "name": p.get("name"),
                            "tvl": p.get("tvl", 0),
                            "change_1d": p.get("change_1d", 0),
                            "change_7d": p.get("change_7d", 0),
                        }
                        for p in sorted(solana_protocols, key=lambda x: x.get("tvl", 0), reverse=True)[:20]
                    ]
                return []
        except Exception as e:
            logger.error(f"DefiLlama protocols exception: {e}")
            return []

    async def close(self):
        if self.session and not self.session.closed:
            await self.session.close()
