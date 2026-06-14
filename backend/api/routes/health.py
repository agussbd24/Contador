from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.config import API_HOST, API_PORT
from backend.utils.logger import setup_logger

logger = setup_logger("api")


def create_app() -> FastAPI:
    app = FastAPI(
        title="Solana Quant API",
        version="1.0.0",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/api/health")
    async def health():
        return {"status": "ok"}

    return app
