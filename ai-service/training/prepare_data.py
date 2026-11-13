"""Tahap 1 — Preprocessing data transaksi menjadi data harian untuk forecasting.

Input : data/raw/transaksi.csv  (CSV "Detail transaksi" dari halaman Export / `npm run export:training`)
Output: data/processed/daily_sales.csv + reports/data_quality.json

Langkah:
  1. Load & standarisasi nama kolom
  2. Validasi tipe data (tanggal, angka)
  3. Cleaning: rapikan nama menu (spasi/kapitalisasi), buang transaksi dibatalkan,
     buang qty <= 0 / harga tidak valid, buang duplikat baris
  4. Cek konsistensi: subtotal == qty x harga
  5. Agregasi per hari: omzet (sales), cup, jumlah transaksi
  6. Lengkapi tanggal yang bolong (hari tanpa penjualan = 0) agar deret waktu kontinu
Jalankan:  python -m training.prepare_data   (dari folder ai-service)
"""

from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw" / "transaksi.csv"
OUT = ROOT / "data" / "processed" / "daily_sales.csv"
REPORT = ROOT / "reports" / "data_quality.json"

COLUMN_MAP = {
    "Tanggal": "date", "Jam": "time", "Kode": "code", "Kasir": "cashier", "Metode Bayar": "payment",
    "Menu": "product", "Qty": "qty", "Harga": "price", "Subtotal": "subtotal", "Status": "status", "Catatan": "note",
}


def load_raw(path: Path = RAW) -> pd.DataFrame:
    df = pd.read_csv(path, encoding="utf-8-sig")
    missing = [c for c in COLUMN_MAP if c not in df.columns]
    if missing:
        raise ValueError(f"Kolom wajib tidak ada di {path.name}: {missing}")
    return df.rename(columns=COLUMN_MAP)


def clean(df: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    q: dict = {"rows_raw": int(len(df))}

    df = df.copy()
    df["date"] = pd.to_datetime(df["date"], errors="coerce")
    for col in ["qty", "price", "subtotal"]:
        df[col] = pd.to_numeric(df[col], errors="coerce")
    q["invalid_date"] = int(df["date"].isna().sum())
    q["invalid_number"] = int(df[["qty", "price", "subtotal"]].isna().any(axis=1).sum())
    df = df.dropna(subset=["date", "qty", "price", "subtotal"])

    # nama menu: hapus spasi berlebih & samakan kapitalisasi ("Ice black Tea " -> "Ice Black Tea")
    before = df["product"].nunique()
    df["product"] = df["product"].astype(str).str.strip().str.replace(r"\s+", " ", regex=True).str.title()
    q["product_names_merged"] = int(before - df["product"].nunique())

    q["voided_rows"] = int((df["status"] != "Selesai").sum())
    df = df[df["status"] == "Selesai"]

    q["non_positive_qty"] = int((df["qty"] <= 0).sum())
    df = df[(df["qty"] > 0) & (df["price"] >= 0)]

    dup = df.duplicated(subset=["code", "product", "qty", "subtotal"])
    q["duplicate_rows"] = int(dup.sum())
    df = df[~dup]

    mismatch = (df["qty"] * df["price"] - df["subtotal"]).abs() > 0.5
    q["subtotal_mismatch"] = int(mismatch.sum())
    df.loc[mismatch, "subtotal"] = df.loc[mismatch, "qty"] * df.loc[mismatch, "price"]

    q["rows_clean"] = int(len(df))
    q["is_dummy"] = bool(df["note"].astype(str).str.contains("dummy", case=False).any())
    return df, q


def to_daily(df: pd.DataFrame) -> pd.DataFrame:
    daily = (
        df.groupby(df["date"].dt.normalize())
        .agg(sales=("subtotal", "sum"), cups=("qty", "sum"), transactions=("code", "nunique"))
        .reset_index()
    )
    full = pd.DataFrame({"date": pd.date_range(daily["date"].min(), daily["date"].max(), freq="D")})
    daily = full.merge(daily, on="date", how="left").fillna({"sales": 0, "cups": 0, "transactions": 0})
    daily[["sales", "cups", "transactions"]] = daily[["sales", "cups", "transactions"]].astype(int)
    return daily


def main() -> None:
    raw = load_raw()
    df, quality = clean(raw)
    daily = to_daily(df)
    quality.update(
        days=int(len(daily)),
        zero_sales_days=int((daily["sales"] == 0).sum()),
        date_start=str(daily["date"].min().date()),
        date_end=str(daily["date"].max().date()),
        total_sales=int(daily["sales"].sum()),
        total_cups=int(daily["cups"].sum()),
    )

    OUT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    daily.assign(date=daily["date"].dt.strftime("%Y-%m-%d")).to_csv(OUT, index=False)
    REPORT.write_text(json.dumps(quality, indent=2, ensure_ascii=False), encoding="utf-8")

    print(f"✓ {quality['rows_clean']}/{quality['rows_raw']} baris bersih → {quality['days']} hari ({quality['date_start']} s/d {quality['date_end']})")
    print(f"  Disimpan: {OUT.relative_to(ROOT)}  |  Laporan kualitas: {REPORT.relative_to(ROOT)}")
    if quality["is_dummy"]:
        print("  ⚠ Data berlabel DUMMY — metrik model hanya ilustrasi, ulangi training dengan data riil.")


if __name__ == "__main__":
    main()
