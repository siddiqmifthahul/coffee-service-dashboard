import os

os.environ["GEMINI_API_KEY"] = ""  # tes selalu memakai mode cadangan (tanpa panggilan jaringan)

from datetime import date, timedelta  # noqa: E402

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.intent import classify  # noqa: E402
from app.main import app  # noqa: E402

client = TestClient(app)

# 10 pertanyaan di luar konteks (checklist guardrail chatbot)
OUT_OF_CONTEXT = [
    "Siapa presiden Indonesia sekarang?",
    "Bagaimana cuaca di Banda Aceh besok?",
    "Tolong buatkan kode python untuk kalkulator",
    "Siapa yang menang sepak bola tadi malam?",
    "Rekomendasikan film horor terbaru",
    "Apa zodiak yang cocok dengan Leo?",
    "Berapa harga bitcoin hari ini?",
    "Tolong terjemahkan kalimat ini ke bahasa Inggris",
    "Buatkan puisi tentang hujan",
    "Apa ibu kota Australia?",
]

IN_CONTEXT = {
    "Berapa penjualan hari ini?": "tanya_penjualan",
    "Pengeluaran bulan ini berapa?": "tanya_penjualan",
    "Menu apa yang paling laris?": "tanya_produk",
    "Harga aren latte berapa?": "tanya_produk",
    "Beri saran untuk menaikkan penjualan": "minta_saran",
    "Kasir lambat sekali melayani, saya kecewa": "keluhan",
}


@pytest.mark.parametrize("question", OUT_OF_CONTEXT)
def test_guardrail_menolak_pertanyaan_di_luar_konteks(question):
    res = client.post("/chat", json={"message": question, "context": {}})
    assert res.status_code == 200
    body = res.json()
    assert body["intent"] == "di_luar_konteks"
    assert "hanya bisa membantu seputar usaha" in body["reply"]


@pytest.mark.parametrize(("question", "expected"), IN_CONTEXT.items())
def test_intent_dalam_konteks(question, expected):
    assert classify(question)[0] == expected


def test_chat_fallback_memakai_data_konteks():
    ctx = {
        "today": {"totals": {"sales": 54000, "transactions": 3, "cups": 3, "expense": 20000}},
        "this_month": {"totals": {"income": 1669000, "expense": 1763333, "net": -94333}, "top_products": [], "expense_by_category": []},
    }
    body = client.post("/chat", json={"message": "Berapa penjualan hari ini?", "context": ctx}).json()
    assert body["is_fallback"] is True
    assert "Rp54.000" in body["reply"]


def test_keluhan_diteruskan_ke_pemilik():
    body = client.post("/chat", json={"message": "Saya mau komplain, pesanan salah", "context": {}}).json()
    assert body["intent"] == "keluhan"
    assert body["escalate"] is True


def _history(days=56):
    start = date(2026, 9, 1)
    out = []
    for i in range(days):
        d = start + timedelta(days=i)
        weekend = d.weekday() >= 4
        out.append({"date": d.isoformat(), "sales": 250000 if weekend else 150000, "cups": 15 if weekend else 9, "transactions": 8})
    return out


def test_predict_sales_mengembalikan_7_hari():
    res = client.post("/predict-sales", json={"history": _history(), "horizon": 7})
    assert res.status_code == 200
    body = res.json()
    assert len(body["predictions"]) == 7
    assert body["predictions"][0]["date"] == "2026-10-27"
    # pola akhir pekan lebih ramai harus tertangkap
    by_day = {date.fromisoformat(p["date"]).weekday(): p["sales"] for p in body["predictions"]}
    assert by_day[5] > by_day[1]
    assert body["metrics"]["mae"] is not None


def test_predict_sales_validasi_input():
    res = client.post("/predict-sales", json={"history": [], "horizon": 7})
    assert res.status_code == 422


def test_insight_fallback_tanpa_api_key():
    body = client.post("/generate-insight", json={
        "period": {"from": "2026-11-01", "to": "2026-11-12"},
        "totals": {"income": 1669000, "expense": 1763333, "net": -94333, "cups": 99, "transactions": 70},
        "change_pct": {"income": -20.5},
        "top_products": [{"name": "Ice Sanger Cees", "qty": 38, "sales": 684000}],
        "expense_by_category": [{"category": "Gaji Barista", "amount": 800000}],
    }).json()
    assert body["is_fallback"] is True
    assert "Ice Sanger Cees" in body["insight"]
    assert any("minus" in r for r in body["recommendations"])
