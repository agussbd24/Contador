import os
import json
import pickle
import numpy as np
from datetime import datetime, timezone
from typing import Tuple, Optional

from backend.config import MODEL_PATH
from backend.utils.logger import setup_logger

logger = setup_logger("ml_model")

FEATURES = [
    "close", "open", "high", "low", "volume",
    "price_change_1h", "price_change_4h", "price_change_24h",
    "volatility_24h", "volume_change_1h",
    "rsi_14", "rsi_7", "macd", "macd_signal", "macd_histogram",
    "ema_9", "ema_21", "ema_50",
    "bb_upper", "bb_middle", "bb_lower", "bb_width",
    "atr", "adx", "stoch_k", "stoch_d",
    "vwap", "obv_trend",
    "fear_greed", "fear_greed_change",
    "exchange_flow", "whale_volume",
    "volume_ratio", "rsi_divergence",
]


class MLModel:
    def __init__(self):
        self.model = None
        self.scaler = None
        self.version = "v1.0.0"
        self.is_loaded = False

    def train(self, X: np.ndarray, y: np.ndarray) -> dict:
        try:
            from xgboost import XGBClassifier
            from sklearn.model_selection import train_test_split
            from sklearn.preprocessing import StandardScaler
            from sklearn.metrics import accuracy_score, roc_auc_score

            X_train, X_temp, y_train, y_temp = train_test_split(X, y, test_size=0.3, random_state=42)
            X_val, X_test, y_val, y_test = train_test_split(X_temp, y_temp, test_size=0.5, random_state=42)

            self.scaler = StandardScaler()
            X_train_s = self.scaler.fit_transform(X_train)
            X_val_s = self.scaler.transform(X_val)
            X_test_s = self.scaler.transform(X_test)

            self.model = XGBClassifier(
                n_estimators=300,
                max_depth=5,
                learning_rate=0.05,
                subsample=0.8,
                colsample_bytree=0.8,
                min_child_weight=5,
                reg_alpha=0.1,
                reg_lambda=1.0,
                objective="binary:logistic",
                eval_metric="auc",
                use_label_encoder=False,
                random_state=42,
            )

            self.model.fit(
                X_train_s, y_train,
                eval_set=[(X_val_s, y_val)],
                verbose=False,
            )

            train_pred = self.model.predict(X_train_s)
            val_pred = self.model.predict(X_test_s)

            train_acc = accuracy_score(y_train, train_pred)
            val_acc = accuracy_score(y_test, val_pred)

            overfit_ratio = train_acc / val_acc if val_acc > 0 else 1.0

            self.version = f"v{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}"
            self.is_loaded = True

            metrics = {
                "train_score": round(train_acc, 4),
                "val_score": round(val_acc, 4),
                "overfit_ratio": round(overfit_ratio, 4),
                "features": len(FEATURES),
                "samples": len(X),
                "version": self.version,
            }

            logger.info(f"Model trained: {metrics}")
            return metrics

        except ImportError:
            logger.warning("XGBoost not available, using fallback model")
            return self._train_fallback(X, y)

    def _train_fallback(self, X: np.ndarray, y: np.ndarray) -> dict:
        from sklearn.ensemble import RandomForestClassifier
        from sklearn.preprocessing import StandardScaler
        from sklearn.model_selection import train_test_split
        from sklearn.metrics import accuracy_score

        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

        self.scaler = StandardScaler()
        X_train_s = self.scaler.fit_transform(X_train)
        X_test_s = self.scaler.transform(X_test)

        self.model = RandomForestClassifier(n_estimators=100, max_depth=5, random_state=42)
        self.model.fit(X_train_s, y_train)

        train_acc = accuracy_score(y_train, self.model.predict(X_train_s))
        val_acc = accuracy_score(y_test, self.model.predict(X_test_s))

        self.version = f"v{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}_fallback"
        self.is_loaded = True

        return {
            "train_score": round(train_acc, 4),
            "val_score": round(val_acc, 4),
            "overfit_ratio": round(train_acc / val_acc if val_acc > 0 else 1.0, 4),
            "model_type": "RandomForest",
            "version": self.version,
        }

    def predict(self, features: np.ndarray) -> Tuple[int, float]:
        if not self.is_loaded or self.model is None:
            return 0, 0.5

        try:
            features_s = self.scaler.transform(features.reshape(1, -1))
            prediction = self.model.predict(features_s)[0]
            probability = self.model.predict_proba(features_s)[0]
            confidence = float(max(probability))
            return int(prediction), confidence
        except Exception as e:
            logger.error(f"Prediction error: {e}")
            return 0, 0.5

    def save(self, path: str = None):
        if path is None:
            path = os.path.join(MODEL_PATH, f"model_{self.version}.pkl")
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "wb") as f:
            pickle.dump({"model": self.model, "scaler": self.scaler, "version": self.version}, f)
        logger.info(f"Model saved to {path}")

    def load(self, path: str) -> bool:
        try:
            with open(path, "rb") as f:
                data = pickle.load(f)
                self.model = data["model"]
                self.scaler = data["scaler"]
                self.version = data.get("version", "unknown")
                self.is_loaded = True
            logger.info(f"Model loaded from {path}")
            return True
        except Exception as e:
            logger.error(f"Model load error: {e}")
            return False

    def get_feature_importance(self) -> dict:
        if self.model is None:
            return {}
        try:
            importances = self.model.feature_importances_
            return {FEATURES[i]: round(float(importances[i]), 4) for i in range(min(len(FEATURES), len(importances)))}
        except Exception:
            return {}
