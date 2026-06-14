import logging
import json
import sys
from datetime import datetime, timezone


class JSONFormatter(logging.Formatter):
    def format(self, record):
        log_entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "component": record.name,
            "message": record.getMessage(),
        }
        if record.exc_info:
            log_entry["exception"] = self.formatException(record.exc_info)
        if hasattr(record, "data"):
            log_entry["data"] = record.data
        return json.dumps(log_entry)


def setup_logger(name: str, level: str = "INFO") -> logging.Logger:
    logger = logging.getLogger(name)
    logger.setLevel(getattr(logging, level.upper()))

    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(JSONFormatter())
        logger.addHandler(handler)

        file_handler = logging.FileHandler("logs/app.log", mode="a")
        file_handler.setFormatter(JSONFormatter())
        logger.addHandler(file_handler)

    return logger


logger = setup_logger("solana_quant")
