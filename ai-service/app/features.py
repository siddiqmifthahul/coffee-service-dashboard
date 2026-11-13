"""Feature engineering untuk forecasting penjualan harian.

Dipakai BERSAMA oleh pipeline training (training/train_forecast.py) dan serving (app/forecast.py)
agar fitur saat latih dan saat prediksi selalu identik.

Semua fitur hanya memakai data SEBELUM hari yang diprediksi (lag/rolling di-shift) -> tidak ada kebocoran data.
"""

from __future__ import annotations

import pandas as pd

TARGETS = ["sales", "cups"]
LAGS = [1, 2, 7, 14]
ROLLING = [7, 14]
MIN_HISTORY = 28  # hari riwayat minimal agar semua fitur (termasuk same_dow_mean_4w) terisi


def calendar_features(dates: pd.Series) -> pd.DataFrame:
    d = pd.to_datetime(dates)
    return pd.DataFrame(
        {
            "dow": d.dt.day_of_week,  # Senin=0 .. Minggu=6
            "is_weekend": (d.dt.day_of_week >= 4).astype(int),  # Jumat–Minggu lebih ramai
            "day_of_month": d.dt.day,
            "is_month_start": (d.dt.day <= 5).astype(int),  # awal bulan (gajian / biaya tetap)
        },
        index=dates.index,
    )


def build_features(daily: pd.DataFrame, target: str) -> pd.DataFrame:
    """daily: kolom date, sales, cups, transactions (1 baris per hari, tanpa tanggal bolong)."""
    df = daily.sort_values("date").reset_index(drop=True).copy()
    feats = calendar_features(df["date"])
    y = df[target].astype(float)
    for lag in LAGS:
        feats[f"lag_{lag}"] = y.shift(lag)
    for win in ROLLING:
        feats[f"roll_mean_{win}"] = y.shift(1).rolling(win).mean()
    feats["roll_std_7"] = y.shift(1).rolling(7).std()
    # rata-rata hari yang sama di 4 minggu terakhir (pola mingguan)
    feats["same_dow_mean_4w"] = (y.shift(7) + y.shift(14) + y.shift(21) + y.shift(28)) / 4
    feats["date"] = df["date"].values
    feats["y"] = y.values
    return feats


FEATURE_COLUMNS = (
    ["dow", "is_weekend", "day_of_month", "is_month_start"]
    + [f"lag_{l}" for l in LAGS]
    + [f"roll_mean_{w}" for w in ROLLING]
    + ["roll_std_7", "same_dow_mean_4w"]
)


def recursive_forecast(model, history: pd.DataFrame, target: str, horizon: int) -> list[float]:
    """Prediksi multi-hari secara rekursif: hasil hari ke-n dipakai sebagai lag untuk hari ke-n+1."""
    hist = history[["date", target]].copy()
    hist["date"] = pd.to_datetime(hist["date"])
    preds = []
    for _ in range(horizon):
        next_date = hist["date"].max() + pd.Timedelta(days=1)
        frame = pd.concat([hist, pd.DataFrame({"date": [next_date], target: [float("nan")]})], ignore_index=True)
        row = build_features(frame.rename(columns={target: target}), target).iloc[[-1]][FEATURE_COLUMNS]
        yhat = max(float(model.predict(row)[0]), 0.0)
        preds.append(yhat)
        hist = pd.concat([hist, pd.DataFrame({"date": [next_date], target: [yhat]})], ignore_index=True)
    return preds
