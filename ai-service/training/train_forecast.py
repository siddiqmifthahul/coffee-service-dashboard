"""Tahap 2 — Training & komparasi model forecasting penjualan harian.

Model yang dibandingkan (metrik SAMA: MAE, RMSE, R² pada data uji yang disisihkan):
  1. Baseline        : rata-rata 4 minggu terakhir x faktor hari-dalam-minggu (tanpa ML)
  2. RandomForest    : konfigurasi default
  3. XGBoost         : konfigurasi default
  4. RandomForest-tuned / 5. XGBoost-tuned : hyperparameter dicari dengan GridSearchCV + TimeSeriesSplit
     (hanya memakai data TRAIN -> tidak bocor ke data uji)

Pembagian data berbasis WAKTU (bukan acak): 21 hari terakhir = data uji.
Evaluasi utama: one-step-ahead (prediksi besok dari data s/d hari ini) — sesuai cara pemakaian harian.
Evaluasi tambahan: prediksi rekursif 7 hari (seperti kartu "Prediksi 7 hari" di dashboard).

Model terbaik (MAE omzet terkecil) disimpan ke models/forecast_model.joblib dan otomatis dipakai
oleh endpoint /predict-sales. Jika baseline yang terbaik, tidak ada model ML yang dipasang.

Jalankan:  python -m training.train_forecast   (setelah training.prepare_data)
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import GridSearchCV, TimeSeriesSplit
from xgboost import XGBRegressor

from app.features import FEATURE_COLUMNS, MIN_HISTORY, build_features, recursive_forecast

ROOT = Path(__file__).resolve().parent.parent
DAILY = ROOT / "data" / "processed" / "daily_sales.csv"
QUALITY = ROOT / "reports" / "data_quality.json"
MODEL_OUT = ROOT / "models" / "forecast_model.joblib"
REPORT_MD = ROOT / "reports" / "model_comparison.md"
REPORT_JSON = ROOT / "reports" / "model_comparison.json"

TEST_DAYS = 21
SEED = 42


class WeekdayBaseline:
    """Baseline non-ML yang sama dengan app/forecast.py (dibungkus agar API-nya mirip model sklearn)."""

    def __init__(self, target: str):
        self.target = target
        self.history: pd.DataFrame | None = None

    def fit_history(self, history: pd.DataFrame):
        self.history = history.sort_values("date")
        return self

    def predict_next(self, history: pd.DataFrame) -> float:
        h = history.sort_values("date")
        recent = h.tail(28)
        level = recent[self.target].mean()
        overall = h[self.target].mean()
        dow = (pd.to_datetime(h["date"].max()) + pd.Timedelta(days=1)).day_of_week
        same = h[pd.to_datetime(h["date"]).dt.day_of_week == dow][self.target]
        if overall > 0 and len(same):
            weight = min(len(same) / 4, 1.0)
            factor = 1 + (same.mean() / overall - 1) * weight
        else:
            factor = 1.0
        return float(level * factor)


@dataclass
class Result:
    name: str
    mae: float
    rmse: float
    r2: float
    mae_7d: float
    params: dict


def metrics(y_true, y_pred) -> tuple[float, float, float]:
    return (
        float(mean_absolute_error(y_true, y_pred)),
        float(np.sqrt(mean_squared_error(y_true, y_pred))),
        float(r2_score(y_true, y_pred)),
    )


def make_models() -> dict:
    return {
        "RandomForest": (RandomForestRegressor(n_estimators=300, min_samples_leaf=2, random_state=SEED, n_jobs=-1), None),
        "XGBoost": (XGBRegressor(n_estimators=300, learning_rate=0.05, max_depth=3, subsample=0.9, random_state=SEED), None),
        "RandomForest-tuned": (
            RandomForestRegressor(random_state=SEED, n_jobs=-1),
            {"n_estimators": [200, 500], "max_depth": [3, 5, None], "min_samples_leaf": [1, 3, 5], "max_features": [0.5, 1.0]},
        ),
        "XGBoost-tuned": (
            XGBRegressor(random_state=SEED),
            {"n_estimators": [100, 300], "max_depth": [2, 3, 4], "learning_rate": [0.03, 0.1], "subsample": [0.8, 1.0],
             "reg_lambda": [1.0, 5.0]},
        ),
    }


def evaluate(daily: pd.DataFrame, target: str) -> tuple[list[Result], dict]:
    feats = build_features(daily, target).iloc[MIN_HISTORY:].reset_index(drop=True)
    train, test = feats.iloc[:-TEST_DAYS], feats.iloc[-TEST_DAYS:]
    X_tr, y_tr, X_te, y_te = train[FEATURE_COLUMNS], train["y"], test[FEATURE_COLUMNS], test["y"]
    split_date = pd.to_datetime(test["date"].iloc[0])
    hist_before_test = daily[pd.to_datetime(daily["date"]) < split_date]
    first_week = daily[(pd.to_datetime(daily["date"]) >= split_date)].head(7)[target].values

    results: list[Result] = []
    fitted: dict = {}

    # 1) Baseline: one-step-ahead dengan riwayat s/d hari sebelumnya
    base = WeekdayBaseline(target)
    preds = []
    for d in test["date"]:
        preds.append(base.predict_next(daily[pd.to_datetime(daily["date"]) < pd.to_datetime(d)]))
    mae, rmse, r2 = metrics(y_te, preds)
    rec, h = [], hist_before_test.copy()
    for i in range(7):
        p = base.predict_next(h)
        rec.append(p)
        nd = pd.to_datetime(h["date"].max()) + pd.Timedelta(days=1)
        h = pd.concat([h, pd.DataFrame({"date": [nd], target: [p]})], ignore_index=True)
    results.append(Result("Baseline (rata-rata x faktor hari)", mae, rmse, r2, float(mean_absolute_error(first_week, rec)), {}))
    fitted["Baseline (rata-rata x faktor hari)"] = None

    # 2-5) Model ML
    cv = TimeSeriesSplit(n_splits=4)
    for name, (model, grid) in make_models().items():
        params = {}
        if grid:
            search = GridSearchCV(model, grid, cv=cv, scoring="neg_mean_absolute_error", n_jobs=-1)
            search.fit(X_tr, y_tr)
            model, params = search.best_estimator_, search.best_params_
        else:
            model.fit(X_tr, y_tr)
        y_hat = np.clip(model.predict(X_te), 0, None)
        mae, rmse, r2 = metrics(y_te, y_hat)
        rec = recursive_forecast(model, hist_before_test[["date", target]], target, 7)
        results.append(Result(name, mae, rmse, r2, float(mean_absolute_error(first_week, rec)), params))
        fitted[name] = model

    info = {
        "train_rows": int(len(train)),
        "test_rows": int(len(test)),
        "train_period": [str(pd.to_datetime(train["date"].iloc[0]).date()), str(pd.to_datetime(train["date"].iloc[-1]).date())],
        "test_period": [str(pd.to_datetime(test["date"].iloc[0]).date()), str(pd.to_datetime(test["date"].iloc[-1]).date())],
        "test_mean": float(y_te.mean()),
    }
    return results, {"fitted": fitted, "info": info}


def refit_full(model_name: str, daily: pd.DataFrame, template, target: str):
    """Latih ulang model terpilih pada SELURUH data (train+test) sebelum dipasang ke produksi."""
    feats = build_features(daily, target).iloc[MIN_HISTORY:]
    model = template.__class__(**template.get_params())
    model.fit(feats[FEATURE_COLUMNS], feats["y"])
    return model


def fmt_rp(v: float) -> str:
    return "Rp" + f"{v:,.0f}".replace(",", ".")


def main() -> None:
    daily = pd.read_csv(DAILY, parse_dates=["date"])
    quality = json.loads(QUALITY.read_text(encoding="utf-8")) if QUALITY.exists() else {}
    if len(daily) < MIN_HISTORY + TEST_DAYS + 14:
        raise SystemExit(f"Data terlalu sedikit ({len(daily)} hari). Minimal {MIN_HISTORY + TEST_DAYS + 14} hari.")

    report: dict = {"generated_at": datetime.now().isoformat(timespec="seconds"), "is_dummy": quality.get("is_dummy", False), "targets": {}}
    best: dict = {}
    for target in ["sales", "cups"]:
        results, extra = evaluate(daily, target)
        results.sort(key=lambda r: r.mae)
        report["targets"][target] = {"info": extra["info"], "results": [r.__dict__ for r in results]}
        best[target] = (results[0], extra["fitted"][results[0].name])
        print(f"\n=== Target: {target} (uji {extra['info']['test_period'][0]} s/d {extra['info']['test_period'][1]}) ===")
        for r in results:
            print(f"  {r.name:<36} MAE={r.mae:>11.1f}  RMSE={r.rmse:>11.1f}  R2={r.r2:>6.3f}  MAE-7hari={r.mae_7d:>11.1f}")

    winner, model = best["sales"]
    report["selected"] = winner.name
    MODEL_OUT.parent.mkdir(parents=True, exist_ok=True)
    if model is None:
        report["deployed"] = False
        if MODEL_OUT.exists():
            MODEL_OUT.unlink()
        print(f"\n→ Model terbaik: {winner.name}. Model ML TIDAK dipasang; /predict-sales tetap memakai baseline.")
    else:
        cups_name, cups_model = best["cups"]
        if cups_model is None:  # untuk cup pakai model sejenis agar konsisten
            cups_model = dict(make_models())[winner.name.replace("-tuned", "")][0] if "tuned" not in winner.name else model
        artifact = {
            "model_name": winner.name,
            "sales_model": refit_full(winner.name, daily, model, "sales"),
            "cups_model": refit_full(winner.name, daily, cups_model, "cups"),
            "feature_columns": FEATURE_COLUMNS,
            "metrics": {"mae": round(winner.mae), "rmse": round(winner.rmse), "r2": round(winner.r2, 3), "mae_7d": round(winner.mae_7d)},
            "trained_until": str(daily["date"].max().date()),
            "is_dummy": report["is_dummy"],
        }
        joblib.dump(artifact, MODEL_OUT)
        report["deployed"] = True
        print(f"\n→ Model terbaik: {winner.name} — disimpan ke {MODEL_OUT.relative_to(ROOT)}")

    REPORT_JSON.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    REPORT_MD.write_text(render_markdown(report), encoding="utf-8")
    print(f"  Laporan: {REPORT_MD.relative_to(ROOT)}")


def render_markdown(report: dict) -> str:
    lines = ["# Perbandingan Model Forecasting Penjualan Harian", ""]
    if report["is_dummy"]:
        lines += ["> ⚠️ **Dilatih dengan data DUMMY** (transaksi harian dibangkitkan dari rekap bulanan Excel UMKM).",
                  "> Pola harian bersifat acak sehingga metrik di bawah hanya **ilustrasi pipeline**, bukan klaim akurasi.", ""]
    for target, label, fmt in [("sales", "Omzet harian (Rp)", fmt_rp), ("cups", "Jumlah cup per hari", lambda v: f"{v:.2f}")]:
        t = report["targets"][target]
        info = t["info"]
        lines += [f"## Target: {label}", "",
                  f"Train: {info['train_period'][0]} s/d {info['train_period'][1]} ({info['train_rows']} hari) · "
                  f"Uji: {info['test_period'][0]} s/d {info['test_period'][1]} ({info['test_rows']} hari) · "
                  f"rata-rata aktual uji = {fmt(info['test_mean'])}", "",
                  "| Peringkat | Model | MAE ↓ | RMSE ↓ | R² ↑ | MAE prediksi 7 hari ↓ |", "|---|---|---|---|---|---|"]
        for i, r in enumerate(t["results"], 1):
            lines.append(f"| {i} | {r['name']} | {fmt(r['mae'])} | {fmt(r['rmse'])} | {r['r2']:.3f} | {fmt(r['mae_7d'])} |")
        tuned = [r for r in t["results"] if r["params"]]
        if tuned:
            lines += ["", "Hyperparameter terbaik (GridSearchCV + TimeSeriesSplit 4 lipatan, hanya data train):"]
            lines += [f"- **{r['name']}**: `{r['params']}`" for r in tuned]
        lines.append("")
    lines += ["## Model terpilih", "",
              f"**{report['selected']}** — MAE omzet terkecil pada data uji. "
              + ("Model ini dilatih ulang dengan seluruh data lalu dipasang ke endpoint `/predict-sales`."
                 if report["deployed"] else
                 "Karena baseline tidak terkalahkan, model ML **tidak dipasang**; endpoint `/predict-sales` tetap memakai baseline."),
              "", f"_Dibuat otomatis oleh `training/train_forecast.py` pada {report['generated_at']}._", ""]
    return "\n".join(lines)


if __name__ == "__main__":
    main()
