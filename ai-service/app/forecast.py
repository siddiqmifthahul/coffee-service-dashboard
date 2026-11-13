"""Forecasting penjualan harian.

Urutan model yang dipakai /predict-sales:
  1. models/forecast_model.joblib  -> model ML terpilih dari `python -m training.train_forecast`
     (Random Forest / XGBoost; hanya dipasang jika mengalahkan baseline pada data uji)
  2. models/custom_forecaster.py   -> model buatan tim dengan antarmuka bebas (lihat di bawah)
  3. Baseline: rata-rata 4 minggu terakhir x faktor hari-dalam-minggu (seasonal naive yang dihaluskan).

Antarmuka custom: buat file `models/custom_forecaster.py` berisi fungsi

    def predict(history: list[dict], horizon: int) -> list[dict]:
        # history: [{"date": "YYYY-MM-DD", "sales": int, "cups": int, "transactions": int}, ...]
        # return:  [{"date": "YYYY-MM-DD", "sales": float, "cups": float}, ...]  (panjang = horizon)

opsional juga variabel `MODEL_NAME` dan `METRICS` (dict, mis. {"mae": ..., "rmse": ..., "r2": ...}).
"""

from __future__ import annotations

import importlib.util
import logging
from datetime import date, timedelta
from pathlib import Path
from statistics import mean

log = logging.getLogger("forecast")
CUSTOM_PATH = Path(__file__).resolve().parent.parent / "models" / "custom_forecaster.py"


def _load_custom():
    if not CUSTOM_PATH.exists():
        return None
    try:
        spec = importlib.util.spec_from_file_location("custom_forecaster", CUSTOM_PATH)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)  # type: ignore[union-attr]
        if hasattr(mod, "predict"):
            log.info("Memakai model custom: %s", getattr(mod, "MODEL_NAME", "custom"))
            return mod
    except Exception as exc:  # noqa: BLE001
        log.warning("Gagal memuat model custom, kembali ke baseline: %s", exc)
    return None


_custom = _load_custom()

ML_PATH = Path(__file__).resolve().parent.parent / "models" / "forecast_model.joblib"


def _load_ml():
    if not ML_PATH.exists():
        return None
    try:
        import joblib

        artifact = joblib.load(ML_PATH)
        log.info("Memakai model ML: %s (dilatih s/d %s)", artifact["model_name"], artifact.get("trained_until"))
        return artifact
    except Exception as exc:  # noqa: BLE001
        log.warning("Gagal memuat %s, memakai baseline: %s", ML_PATH.name, exc)
        return None


_ml = _load_ml()


def ml_predict(artifact: dict, history: list[dict], horizon: int) -> list[dict]:
    import pandas as pd

    from .features import MIN_HISTORY, recursive_forecast

    if len(history) < MIN_HISTORY:
        raise ValueError(f"Riwayat kurang dari {MIN_HISTORY} hari")
    df = pd.DataFrame(history)
    df["date"] = pd.to_datetime(df["date"])
    sales = recursive_forecast(artifact["sales_model"], df[["date", "sales"]], "sales", horizon)
    cups = recursive_forecast(artifact["cups_model"], df[["date", "cups"]], "cups", horizon)
    start = df["date"].max().date() + timedelta(days=1)
    return [{"date": (start + timedelta(days=i)).isoformat(), "sales": s, "cups": c} for i, (s, c) in enumerate(zip(sales, cups))]


def _weekday_factors(history: list[dict], key: str) -> list[float]:
    """Faktor pengali tiap hari (Senin=0..Minggu=6) relatif terhadap rata-rata keseluruhan."""
    overall = mean(h[key] for h in history) if history else 0
    factors = []
    for wd in range(7):
        vals = [h[key] for h in history if date.fromisoformat(h["date"]).weekday() == wd]
        if overall > 0 and vals:
            # dihaluskan ke arah 1.0 agar tidak terlalu ekstrem saat data sedikit
            raw = mean(vals) / overall
            weight = min(len(vals) / 4, 1.0)
            factors.append(1 + (raw - 1) * weight)
        else:
            factors.append(1.0)
    return factors


def baseline_predict(history: list[dict], horizon: int) -> list[dict]:
    history = sorted(history, key=lambda h: h["date"])
    start = date.fromisoformat(history[-1]["date"]) + timedelta(days=1) if history else date.today()
    recent = history[-28:]
    level_sales = mean(h["sales"] for h in recent) if recent else 0
    level_cups = mean(h["cups"] for h in recent) if recent else 0
    f_sales = _weekday_factors(history, "sales")
    f_cups = _weekday_factors(history, "cups")

    out = []
    for i in range(horizon):
        d = start + timedelta(days=i)
        wd = d.weekday()
        out.append({"date": d.isoformat(), "sales": level_sales * f_sales[wd], "cups": level_cups * f_cups[wd]})
    return out


def backtest_mae(history: list[dict], horizon: int = 7) -> float | None:
    """MAE baseline pada `horizon` hari terakhir yang disisihkan (holdout)."""
    if len(history) < horizon + 14:
        return None
    train, test = history[:-horizon], history[-horizon:]
    preds = baseline_predict(train, horizon)
    return mean(abs(p["sales"] - t["sales"]) for p, t in zip(preds, test))


def predict(history: list[dict], horizon: int) -> dict:
    history = sorted(history, key=lambda h: h["date"])
    active_days = sum(1 for h in history if h["sales"] > 0)

    if _ml is not None:
        try:
            return {
                "predictions": ml_predict(_ml, history, horizon),
                "model_name": _ml["model_name"],
                "metrics": {**_ml.get("metrics", {}), "trained_until": _ml.get("trained_until")},
                "is_fallback": False,
            }
        except Exception as exc:  # noqa: BLE001
            log.warning("Model ML error, memakai baseline: %s", exc)

    if _custom is not None:
        try:
            preds = _custom.predict(history, horizon)
            return {
                "predictions": preds,
                "model_name": getattr(_custom, "MODEL_NAME", "custom"),
                "metrics": getattr(_custom, "METRICS", {}),
                "is_fallback": False,
            }
        except Exception as exc:  # noqa: BLE001
            log.warning("Model custom error, memakai baseline: %s", exc)

    preds = baseline_predict(history, horizon)
    return {
        "predictions": preds,
        "model_name": "baseline-weekday-mean",
        "metrics": {"mae": backtest_mae(history), "train_days": len(history)},
        "is_fallback": active_days < 14,
    }
