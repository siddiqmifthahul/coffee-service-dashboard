# Perbandingan Model Forecasting Penjualan Harian

> ⚠️ **Dilatih dengan data DUMMY** (transaksi harian dibangkitkan dari rekap bulanan Excel UMKM).
> Pola harian bersifat acak sehingga metrik di bawah hanya **ilustrasi pipeline**, bukan klaim akurasi.

## Target: Omzet harian (Rp)

Train: 2026-08-29 s/d 2026-10-22 (55 hari) · Uji: 2026-10-23 s/d 2026-11-12 (21 hari) · rata-rata aktual uji = Rp150.333

| Peringkat | Model | MAE ↓ | RMSE ↓ | R² ↑ | MAE prediksi 7 hari ↓ |
|---|---|---|---|---|---|
| 1 | Baseline (rata-rata x faktor hari) | Rp48.600 | Rp57.751 | 0.264 | Rp57.318 |
| 2 | RandomForest-tuned | Rp54.202 | Rp63.128 | 0.121 | Rp63.094 |
| 3 | XGBoost-tuned | Rp54.261 | Rp63.406 | 0.113 | Rp67.163 |
| 4 | RandomForest | Rp54.542 | Rp64.911 | 0.071 | Rp68.790 |
| 5 | XGBoost | Rp63.238 | Rp75.027 | -0.241 | Rp87.714 |

Hyperparameter terbaik (GridSearchCV + TimeSeriesSplit 4 lipatan, hanya data train):
- **RandomForest-tuned**: `{'max_depth': 5, 'max_features': 0.5, 'min_samples_leaf': 3, 'n_estimators': 500}`
- **XGBoost-tuned**: `{'learning_rate': 0.03, 'max_depth': 2, 'n_estimators': 100, 'reg_lambda': 5.0, 'subsample': 0.8}`

## Target: Jumlah cup per hari

Train: 2026-08-29 s/d 2026-10-22 (55 hari) · Uji: 2026-10-23 s/d 2026-11-12 (21 hari) · rata-rata aktual uji = 8.95

| Peringkat | Model | MAE ↓ | RMSE ↓ | R² ↑ | MAE prediksi 7 hari ↓ |
|---|---|---|---|---|---|
| 1 | Baseline (rata-rata x faktor hari) | 2.87 | 3.52 | 0.214 | 3.25 |
| 2 | RandomForest | 2.88 | 3.60 | 0.176 | 3.23 |
| 3 | RandomForest-tuned | 2.90 | 3.55 | 0.201 | 3.26 |
| 4 | XGBoost | 2.90 | 3.81 | 0.077 | 4.05 |
| 5 | XGBoost-tuned | 3.00 | 3.71 | 0.125 | 3.79 |

Hyperparameter terbaik (GridSearchCV + TimeSeriesSplit 4 lipatan, hanya data train):
- **RandomForest-tuned**: `{'max_depth': 3, 'max_features': 0.5, 'min_samples_leaf': 3, 'n_estimators': 500}`
- **XGBoost-tuned**: `{'learning_rate': 0.03, 'max_depth': 2, 'n_estimators': 100, 'reg_lambda': 5.0, 'subsample': 0.8}`

## Model terpilih

**Baseline (rata-rata x faktor hari)** — MAE omzet terkecil pada data uji. Karena baseline tidak terkalahkan, model ML **tidak dipasang**; endpoint `/predict-sales` tetap memakai baseline.

_Dibuat otomatis oleh `training/train_forecast.py` pada 2026-11-13T20:44:29._
