"""Tes pipeline ML: feature engineering tanpa kebocoran & jalur serving model ML."""

import os

os.environ["GEMINI_API_KEY"] = ""

from datetime import date, timedelta  # noqa: E402

import pandas as pd  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sklearn.ensemble import RandomForestRegressor  # noqa: E402

from app import forecast  # noqa: E402
from app.features import FEATURE_COLUMNS, MIN_HISTORY, build_features  # noqa: E402
from app.main import app  # noqa: E402


def _daily(n=70):
    start = date(2026, 8, 1)
    rows = []
    for i in range(n):
        d = start + timedelta(days=i)
        weekend = d.weekday() >= 4
        rows.append({"date": d.isoformat(), "sales": 250000 if weekend else 150000, "cups": 14 if weekend else 8, "transactions": 8})
    return rows


def test_fitur_tidak_bocor_ke_masa_depan():
    df = pd.DataFrame(_daily())
    df["date"] = pd.to_datetime(df["date"])
    feats = build_features(df, "sales")
    # lag_1 hari ke-i harus sama dengan target hari ke-(i-1), bukan hari ke-i
    assert feats.loc[10, "lag_1"] == df.loc[9, "sales"]
    assert feats.loc[10, "roll_mean_7"] == df.loc[3:9, "sales"].mean()
    # baris setelah MIN_HISTORY tidak boleh ada fitur kosong
    assert not feats.iloc[MIN_HISTORY:][FEATURE_COLUMNS].isna().any().any()


def test_endpoint_memakai_model_ml_bila_tersedia(monkeypatch):
    df = pd.DataFrame(_daily())
    df["date"] = pd.to_datetime(df["date"])
    models = {}
    for target in ["sales", "cups"]:
        f = build_features(df, target).iloc[MIN_HISTORY:]
        models[target] = RandomForestRegressor(n_estimators=50, random_state=0).fit(f[FEATURE_COLUMNS], f["y"])
    artifact = {"model_name": "RandomForest-test", "sales_model": models["sales"], "cups_model": models["cups"],
                "metrics": {"mae": 1}, "trained_until": "2026-10-09"}
    monkeypatch.setattr(forecast, "_ml", artifact)

    body = TestClient(app).post("/predict-sales", json={"history": _daily(), "horizon": 7}).json()
    assert body["model_name"] == "RandomForest-test"
    assert len(body["predictions"]) == 7
    by_dow = {date.fromisoformat(p["date"]).weekday(): p["sales"] for p in body["predictions"]}
    assert by_dow[5] > by_dow[1]  # pola akhir pekan ramai tertangkap


def test_ml_gagal_kembali_ke_baseline(monkeypatch):
    monkeypatch.setattr(forecast, "_ml", {"model_name": "rusak", "sales_model": None, "cups_model": None})
    body = TestClient(app).post("/predict-sales", json={"history": _daily(), "horizon": 7}).json()
    assert body["model_name"] == "baseline-weekday-mean"
