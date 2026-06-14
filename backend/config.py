import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://solana_quant:solana_quant@localhost:5432/solana_quant")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

BINANCE_WS_URL = os.getenv("BINANCE_WS_URL", "wss://stream.binance.com:9443/ws")
BINANCE_REST_URL = "https://api.binance.com/api/v3"
SYMBOL = "SOLUSDT"

COINGECKO_API_KEY = os.getenv("COINGECKO_API_KEY", "")
COINGECKO_BASE_URL = "https://api.coingecko.com/api/v3"

FEAR_GREED_URL = "https://api.alternative.me/fng/"

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "")

MIN_CONFIDENCE = int(os.getenv("MIN_CONFIDENCE", "50"))
SIGNAL_COOLDOWN_SECONDS = int(os.getenv("SIGNAL_COOLDOWN_SECONDS", "3600"))
MAX_SIGNALS_PER_DAY = int(os.getenv("MAX_SIGNALS_PER_DAY", "10"))

ML_RETRAIN_INTERVAL_HOURS = int(os.getenv("ML_RETRAIN_INTERVAL_HOURS", "168"))
MODEL_PATH = os.getenv("MODEL_PATH", "./backend/ml/models")

API_HOST = os.getenv("API_HOST", "0.0.0.0")
API_PORT = int(os.getenv("API_PORT", "8000"))

HTTP_PROXY = os.getenv("HTTP_PROXY", "")
HTTPS_PROXY = os.getenv("HTTPS_PROXY", "")
MOCK_DATA = os.getenv("MOCK_DATA", "false").lower() == "true"

TIMEFRAMES = ["5m", "15m", "1h", "4h", "1d"]
PRIMARY_TIMEFRAME = "4h"

TECHNICAL_WEIGHTS = {
    "technical": 0.35,
    "onchain": 0.30,
    "sentiment": 0.20,
    "fundamental": 0.10,
    "risk": 0.05,
}

RISK_PER_TRADE = 0.01
MIN_RR_RATIO = 1.5
MAX_CONCURRENT_SIGNALS = 3
