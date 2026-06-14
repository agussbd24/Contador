import ssl
import aiohttp
from typing import Optional

from backend.utils.logger import setup_logger

logger = setup_logger("solana_rpc")

SSL_CONTEXT = ssl.create_default_context()
SSL_CONTEXT.check_hostname = False
SSL_CONTEXT.verify_mode = ssl.CERT_NONE


class SolanaRPCFetcher:
    def __init__(self):
        self.session: Optional[aiohttp.ClientSession] = None
        self.rpc_url = "https://api.mainnet.solana.com"

    async def _get_session(self) -> aiohttp.ClientSession:
        if self.session is None or self.session.closed:
            connector = aiohttp.TCPConnector(ssl=SSL_CONTEXT)
            self.session = aiohttp.ClientSession(connector=connector)
        return self.session

    async def _rpc_call(self, method: str, params: list = None) -> dict:
        session = await self._get_session()
        payload = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": method,
            "params": params or [],
        }
        try:
            async with session.post(self.rpc_url, json=payload) as resp:
                if resp.status == 200:
                    return await resp.json()
                return {"error": f"HTTP {resp.status}"}
        except Exception as e:
            logger.error(f"Solana RPC error ({method}): {e}")
            return {"error": str(e)}

    async def get_recent_blockhash(self) -> str:
        result = await self._rpc_call("getRecentBlockhash")
        if "result" in result:
            return result["result"]["value"]["blockhash"]
        return ""

    async def get_epoch_info(self) -> dict:
        result = await self._rpc_call("getEpochInfo")
        if "result" in result:
            r = result["result"]
            return {
                "epoch": r.get("epoch", 0),
                "slot_index": r.get("slotIndex", 0),
                "slots_in_epoch": r.get("slotsInEpoch", 0),
                "block_height": r.get("blockHeight", 0),
            }
        return {}

    async def get_vote_accounts(self) -> dict:
        result = await self._rpc_call("getVoteAccounts")
        if "result" in result:
            r = result["result"]
            active = r.get("current", [])
            total_staked = sum(float(v["activatedStake"]) for v in active)
            return {
                "active_validators": len(active),
                "total_staked": total_staked,
            }
        return {"active_validators": 0, "total_staked": 0}

    async def get_supply(self) -> dict:
        result = await self._rpc_call("getSupply")
        if "result" in result:
            r = result["result"]["value"]
            return {
                "total": r.get("total", 0),
                "circulating": r.get("circulating", 0),
                "non_circulating": r.get("nonCirculating", 0),
            }
        return {}

    async def close(self):
        if self.session and not self.session.closed:
            await self.session.close()
