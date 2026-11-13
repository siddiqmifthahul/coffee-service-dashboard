"""Klasifikasi intent baseline berbasis kata kunci (Bahasa Indonesia).

Minimal 4 intent sesuai checklist + 1 intent penolakan:
  tanya_penjualan, tanya_produk, minta_saran, keluhan, di_luar_konteks

Tim AI dapat mengganti fungsi `classify` dengan model terlatih (mis. TF-IDF + LogisticRegression
atau IndoBERT) selama tetap mengembalikan (intent, confidence).
"""

from __future__ import annotations

import re

INTENTS = ["tanya_penjualan", "tanya_produk", "minta_saran", "keluhan", "di_luar_konteks"]

KEYWORDS: dict[str, list[str]] = {
    "keluhan": [
        "keluhan", "komplain", "complain", "kecewa", "lambat", "lama banget", "salah input", "rusak", "error",
        "tidak bisa", "gak bisa", "nggak bisa", "masalah", "bug", "macet", "hilang", "kurang ramah", "basi",
    ],
    "minta_saran": [
        "saran", "rekomendasi", "strategi", "tips", "ide", "bagaimana cara", "gimana cara", "meningkatkan",
        "naikkan", "menaikkan", "tingkatkan", "promo", "promosi", "evaluasi", "sebaiknya", "harus apa", "hemat",
        "mengurangi", "kurangi", "target",
    ],
    "tanya_produk": [
        "menu", "produk", "minuman", "kopi", "harga", "laris", "terlaris", "favorit", "paling banyak dibeli",
        "sanger", "latte", "tea", "teh", "espresso", "long black", "peach", "lemon", "black moon", "aren",
        "extra shot", "hpp",
    ],
    "tanya_penjualan": [
        "penjualan", "omzet", "omset", "pendapatan", "pemasukan", "pengeluaran", "laba", "untung", "rugi",
        "saldo", "transaksi", "terjual", "jual", "rekap", "keuangan", "uang", "hari ini", "bulan ini",
        "minggu ini", "kemarin", "berapa", "biaya", "modal", "cup", "kas", "qris", "tunai", "prediksi", "ramai",
    ],
}

# Topik yang jelas di luar usaha — langsung ditolak walau ada kata kunci umum seperti "berapa"
OFF_TOPIC = [
    "presiden", "politik", "pemilu", "partai", "cuaca", "gempa", "sepak bola", "bola", "film", "lagu",
    "pacar", "zodiak", "ramalan", "game", "coding", "python", "javascript", "matematika", "pr ", "tugas sekolah",
    "resep rendang", "resep masakan", "bitcoin", "saham", "crypto", "kripto", "agama", "gosip", "artis",
    "ibukota", "ibu kota", "planet", "sejarah", "terjemahkan", "translate", "puisi", "pantun", "berita",
]

PRIORITY = ["keluhan", "minta_saran", "tanya_produk", "tanya_penjualan"]


def _norm(text: str) -> str:
    return " " + re.sub(r"\s+", " ", text.lower()).strip() + " "


def classify(message: str) -> tuple[str, float]:
    text = _norm(message)
    if any(k in text for k in OFF_TOPIC):
        return "di_luar_konteks", 0.9

    scores = {intent: sum(1 for k in words if k in text) for intent, words in KEYWORDS.items()}
    best = max(scores.values())
    if best == 0:
        return "di_luar_konteks", 0.6

    top = [i for i in PRIORITY if scores[i] == best]
    intent = top[0]
    confidence = min(0.55 + 0.15 * best, 0.95)
    return intent, round(confidence, 2)
