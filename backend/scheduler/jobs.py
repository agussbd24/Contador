import asyncio
from datetime import datetime, timezone

from backend.utils.logger import setup_logger

logger = setup_logger("scheduler")


class Scheduler:
    def __init__(self, pipeline, binance, coingecko, fear_greed, defillama, telegram):
        self.pipeline = pipeline
        self.binance = binance
        self.coingecko = coingecko
        self.fear_greed = fear_greed
        self.defillama = defillama
        self.telegram = telegram
        self.signal_history = []
        self.last_signal_time = None
        self.last_daily_summary = None
        self.analysis_interval = 300  # 5 minutes
        self.daily_summary_hour = 8  # 8:00 UTC

    async def start(self):
        logger.info("Scheduler started")
        await asyncio.sleep(5)

        while True:
            try:
                await self._run_analysis()
                await asyncio.sleep(self.analysis_interval)
            except asyncio.CancelledError:
                logger.info("Scheduler stopped")
                break
            except Exception as e:
                logger.error(f"Scheduler error: {e}")
                await asyncio.sleep(60)

    async def _run_analysis(self):
        now = datetime.now(timezone.utc)
        logger.info(f"Running analysis at {now.isoformat()}")

        try:
            ticker = await self.binance.get_ticker()
            if not ticker:
                logger.warning("No ticker data available")
                return

            self.binance.latest_price = ticker.get("price", 0)

            klines = await self.binance.get_all_klines_multi_tf()
            if not klines.get("4h"):
                logger.warning("No 4h kline data available")
                return

            fg_data = await self.fear_greed.get_current()
            fear_greed_value = fg_data.get("value", 50)

            onchain_data = {
                "exchange_inflow": 0,
                "exchange_outflow": 5000,
                "whale_transactions_count": 3,
                "whale_volume_sol": 25000,
                "active_addresses": 1200000,
                "new_addresses": 45000,
                "staking_ratio": 0.67,
                "exchange_reserve_change": -0.015,
                "nvt_ratio": 42,
                "sol_staked": 400000000,
                "total_supply": 440000000,
            }

            sentiment_data = {
                "reddit": 0.2,
                "twitter": 0.1,
                "fear_greed": (fear_greed_value - 50) / 50,
                "news": 0.15,
            }

            result = await self.pipeline.run(
                klines_4h=klines.get("4h", []),
                klines_1h=klines.get("1h", []),
                klines_1d=klines.get("1d", []),
                ticker=ticker,
                onchain_data=onchain_data,
                sentiment_data=sentiment_data,
                fear_greed=fear_greed_value,
            )

            result["time"] = now.isoformat()
            self.signal_history.append(result)

            if len(self.signal_history) > 1000:
                self.signal_history = self.signal_history[-500:]

            if result.get("signal") != "HOLD" and result.get("confidence", 0) >= 50:
                should_send = True
                if self.last_signal_time:
                    elapsed = (now - self.last_signal_time).total_seconds()
                    if elapsed < 3600:
                        should_send = False

                if should_send:
                    sent = await self.telegram.send_signal(result)
                    if sent:
                        self.last_signal_time = now
                        logger.info(f"Signal sent: {result['signal']} ({result['confidence']}%)")

            if self._should_send_daily_summary(now):
                await self.telegram.send_daily_summary(
                    self.signal_history[-10:], ticker
                )
                self.last_daily_summary = now.date()

            logger.info(
                f"Analysis complete: {result['signal']} "
                f"({result['confidence']}%) @ ${result.get('price', 0):,.2f}"
            )

        except Exception as e:
            logger.error(f"Analysis error: {e}")

    def _should_send_daily_summary(self, now: datetime) -> bool:
        if self.last_daily_summary == now.date():
            return False
        return now.hour == self.daily_summary_hour and now.minute < 10
