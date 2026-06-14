import aiohttp
from typing import Optional

from backend.config import TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, MIN_CONFIDENCE
from backend.utils.logger import setup_logger

logger = setup_logger("telegram_bot")


class TelegramBot:
    def __init__(self):
        self.session: Optional[aiohttp.ClientSession] = None
        self.bot_token = TELEGRAM_BOT_TOKEN
        self.chat_id = TELEGRAM_CHAT_ID
        self.base_url = f"https://api.telegram.org/bot{self.bot_token}"

    async def _get_session(self) -> aiohttp.ClientSession:
        if self.session is None or self.session.closed:
            self.session = aiohttp.ClientSession()
        return self.session

    async def send_message(self, text: str, parse_mode: str = "HTML") -> bool:
        if not self.bot_token or not self.chat_id:
            logger.warning("Telegram credentials not configured")
            return False

        session = await self._get_session()
        url = f"{self.base_url}/sendMessage"
        payload = {
            "chat_id": self.chat_id,
            "text": text,
            "parse_mode": parse_mode,
        }

        try:
            async with session.post(url, json=payload) as resp:
                if resp.status == 200:
                    logger.info("Telegram message sent")
                    return True
                else:
                    error = await resp.text()
                    logger.error(f"Telegram send error: {resp.status} - {error}")
                    return False
        except Exception as e:
            logger.error(f"Telegram exception: {e}")
            return False

    def format_signal_alert(self, signal_data: dict) -> str:
        signal = signal_data.get("signal", "HOLD")
        confidence = signal_data.get("confidence", 0)
        price = signal_data.get("price", 0)
        breakdown = signal_data.get("breakdown", {})
        risk = signal_data.get("risk_levels", {})

        if confidence < MIN_CONFIDENCE and signal != "HOLD":
            return ""

        emoji_map = {
            "STRONG_BUY": "\U0001f7e2",
            "BUY": "\U0001f7e2",
            "HOLD": "\u26aa",
            "SELL": "\U0001f534",
            "STRONG_SELL": "\U0001f534",
        }
        emoji = emoji_map.get(signal, "\u26aa")

        lines = [
            f"{emoji} <b>{signal.replace('_', ' ')} - SOL/USDT</b>",
            "\u2501" * 28,
            "",
            f"\U0001f4ca Signal: <b>{signal}</b>",
            f"\U0001f3af Confidence: <b>{confidence}%</b>",
            f"\U0001f4b0 Price: <b>${price:,.2f}</b>" if price else "",
            "",
            "\U0001f4c8 Technical: <b>{:+.1f}/10</b>".format(breakdown.get("technical", 0)),
            "\U0001f517 On-Chain: <b>{:+.1f}/10</b>".format(breakdown.get("onchain", 0)),
            "\U0001f4ad Sentiment: <b>{:+.1f}/10</b>".format(breakdown.get("sentiment", 0)),
            "",
        ]

        if risk and risk.get("entry"):
            lines.extend([
                "\u26a1 Risk Management",
                f"   Entry: <b>${risk['entry']:,.2f}</b>",
                f"   Stop Loss: <b>${risk['stop_loss']:,.2f}</b> ({risk.get('risk_pct', 0):.1f}%)",
                f"   Take Profit: <b>${risk['take_profit']:,.2f}</b> ({risk.get('reward_pct', 0):.1f}%)",
                f"   RR Ratio: <b>{risk.get('rr_ratio', 0)}:1</b>",
            ])

        filters = signal_data.get("filter_reasons", [])
        if filters:
            lines.extend(["", f"\u26a0\ufe0f Filters: {', '.join(filters)}"])

        return "\n".join(lines)

    def format_daily_summary(self, signals: list, price_data: dict) -> str:
        total = len(signals)
        buys = sum(1 for s in signals if "BUY" in s.get("signal", ""))
        sells = sum(1 for s in signals if "SELL" in s.get("signal", ""))

        current_signal = signals[0] if signals else {}
        current_price = price_data.get("price", 0)
        change_24h = price_data.get("change_24h", 0)

        lines = [
            "\U0001f4cb <b>DAILY SUMMARY - SOL/USDT</b>",
            "\u2501" * 28,
            "",
            f"\U0001f4ca Current Signal: <b>{current_signal.get('signal', 'N/A')}</b> ({current_signal.get('confidence', 0)}%)",
            f"\U0001f4b0 Price: <b>${current_price:,.2f}</b> (24h: {change_24h:+.1f}%)",
            "",
            f"\U0001f4c8 Signals today: {total}",
            f"   Buys: {buys} | Sells: {sells} | Holds: {total - buys - sells}",
            "",
        ]

        for s in signals[:5]:
            emoji = "\U0001f7e2" if "BUY" in s.get("signal", "") else "\U0001f534" if "SELL" in s.get("signal", "") else "\u26aa"
            lines.append(f"   {emoji} {s.get('time', 'N/A')} - {s.get('signal', 'N/A')} @ ${s.get('price', 0):,.2f}")

        return "\n".join(lines)

    async def send_signal(self, signal_data: dict) -> bool:
        message = self.format_signal_alert(signal_data)
        if message:
            return await self.send_message(message)
        return False

    async def send_daily_summary(self, signals: list, price_data: dict) -> bool:
        message = self.format_daily_summary(signals, price_data)
        return await self.send_message(message)

    async def close(self):
        if self.session and not self.session.closed:
            await self.session.close()
