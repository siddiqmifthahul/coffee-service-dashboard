"""Forecasting penjualan harian.

Baseline: rata-rata 4 minggu terakhir x faktor hari-dalam-minggu (seasonal naive yang dihaluskan).
Tim AI/DS dapat mengganti dengan model sendiri (mis. XGBoost / Random Forest) tanpa mengubah API:
buat file `models/custom_forecaster.py` berisi fungsi

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
