import asyncio
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.config import API_HOST, API_PORT
from backend.data.fetchers.binance import BinanceFetcher
from backend.data.fetchers.coingecko import CoinGeckoFetcher
from backend.data.fetchers.fear_greed import FearGreedFetcher
from backend.data.fetchers.defillama import DefiLlamaFetcher
from backend.data.fetchers.solana_rpc import SolanaRPCFetcher
from backend.ml.predictor import AnalysisPipeline
from backend.ml.model import MLModel
from backend.alerts.telegram_bot import TelegramBot
from backend.scheduler.jobs import Scheduler
from backend.utils.logger import setup_logger

logger = setup_logger("main")

binance = BinanceFetcher()
coingecko = CoinGeckoFetcher()
fear_greed = FearGreedFetcher()
defillama = DefiLlamaFetcher()
solana_rpc = SolanaRPCFetcher()
pipeline = AnalysisPipeline()
telegram = TelegramBot()
scheduler = Scheduler(pipeline, binance, coingecko, fear_greed, defillama, telegram)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Solana Quant Platform...")

    os.makedirs("logs", exist_ok=True)

    scheduler_task = asyncio.create_task(scheduler.start())

    try:
        yield
    finally:
        scheduler_task.cancel()
        await binance.close()
        await coingecko.close()
        await fear_greed.close()
        await defillama.close()
        await solana_rpc.close()
        await telegram.close()
        logger.info("Shutdown complete")


app = FastAPI(
    title="Solana Quant Platform",
    description="Professional SOL analysis and signal generation",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {
        "name": "Solana Quant Platform",
        "version": "1.0.0",
        "status": "running",
    }


@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "components": {
            "binance": "connected" if binance.latest_price else "waiting",
            "ml_model": "loaded" if pipeline.ml_model.is_loaded else "not_trained",
            "telegram": "configured" if telegram.bot_token else "not_configured",
        },
    }


@app.get("/signal")
async def get_signal():
    if not binance.latest_price:
        return {"error": "Waiting for price data..."}

    try:
        klines = await binance.get_all_klines_multi_tf()
        ticker = await binance.get_ticker()

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

        fg_data = await fear_greed.get_current()
        fear_greed_value = fg_data.get("value", 50)

        sentiment_data = {
            "reddit": 0.2,
            "twitter": 0.1,
            "fear_greed": (fear_greed_value - 50) / 50,
            "news": 0.15,
        }

        result = await pipeline.run(
            klines_4h=klines.get("4h", []),
            klines_1h=klines.get("1h", []),
            klines_1d=klines.get("1d", []),
            ticker=ticker,
            onchain_data=onchain_data,
            sentiment_data=sentiment_data,
            fear_greed=fear_greed_value,
        )

        return result

    except Exception as e:
        logger.error(f"Signal generation error: {e}")
        return {"error": str(e)}


@app.get("/price")
async def get_price():
    ticker = await binance.get_ticker()
    return ticker if ticker else {"error": "No price data"}


@app.get("/klines/{timeframe}")
async def get_klines(timeframe: str = "4h", limit: int = 100):
    klines = await binance.get_klines(limit=limit, interval=timeframe)
    return {"timeframe": timeframe, "count": len(klines), "data": klines}


@app.get("/orderbook")
async def get_orderbook():
    return await binance.get_orderbook()


@app.get("/market")
async def get_market():
    ticker = await binance.get_ticker()
    cg_data = await coingecko.get_sol_market_data()
    fg_data = await fear_greed.get_current()

    return {
        "ticker": ticker,
        "coingecko": cg_data,
        "fear_greed": fg_data,
    }


@app.get("/signals/history")
async def get_signal_history():
    return {"signals": scheduler.signal_history[-50:]}


@app.post("/ml/train")
async def train_model():
    try:
        klines = await binance.get_klines(limit=500, interval="4h")
        if len(klines) < 100:
            return {"error": "Not enough data for training"}

        X, y = pipeline.ml_model._prepare_training_data(klines)
        if len(X) < 50:
            return {"error": "Not enough samples"}

        metrics = pipeline.ml_model.train(X, y)
        pipeline.ml_model.save()
        return metrics
    except Exception as e:
        return {"error": str(e)}


@app.get("/ml/status")
async def ml_status():
    return {
        "loaded": pipeline.ml_model.is_loaded,
        "version": pipeline.ml_model.version,
        "features": len(pipeline.ml_model.get_feature_importance()) if pipeline.ml_model.is_loaded else 0,
    }


def start():
    import uvicorn
    uvicorn.run(app, host=API_HOST, port=API_PORT)


if __name__ == "__main__":
    start()
