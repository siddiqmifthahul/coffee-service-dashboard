"""AI Service Coffee Service (FastAPI).

Endpoint:
  POST /predict-sales     -> prediksi penjualan N hari ke depan
  POST /generate-insight  -> ringkasan insight bisnis (Gemini, fallback template)
  POST /chat              -> asisten tanya-jawab dengan intent classifier + guardrail
Dokumentasi interaktif: /docs (Swagger) dan /redoc
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from pydantic import BaseModel, Field  # noqa: E402

from . import forecast, llm  # noqa: E402
from .intent import INTENTS, classify  # noqa: E402
from .prompts import CHAT_SYSTEM, INSIGHT_FEWSHOT, INSIGHT_SYSTEM, REFUSAL  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")

app = FastAPI(
    title="Coffee Service AI API",
    version="1.0.0",
    description=(
        "Layanan Machine Learning & Gen AI untuk Dashboard Rekapan Kasir Coffee Service. "
        "Dipanggil oleh backend Express (bukan langsung dari frontend). "
        "Jika Gemini tidak tersedia (key kosong / kuota habis / timeout), respons tetap 200 dengan `is_fallback: true`."
    ),
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in os.getenv("CORS_ORIGIN", "http://localhost:4000").split(",") if o.strip()],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- util ----------
def rp(n: float | int | None) -> str:
    return "Rp" + f"{round(n or 0):,}".replace(",", ".")


def rp_short(n: float | int | None) -> str:
    v = n or 0
    if abs(v) >= 1_000_000:
        return f"Rp{v / 1_000_000:.1f}".replace(".", ",") + " juta"
    if abs(v) >= 1_000:
        return f"Rp{round(v / 1000)} ribu"
    return rp(v)


def pct_text(p: float | None) -> str:
    if p is None:
        return ""
    if p == 0:
        return "stabil dibanding periode sebelumnya"
    return f"{'naik' if p > 0 else 'turun'} {abs(p):.1f}% dibanding periode sebelumnya".replace(".", ",")


# ---------- schemas ----------
class DayHistory(BaseModel):
    date: str = Field(..., examples=["2026-11-12"])
    sales: int = Field(0, ge=0)
    cups: int = Field(0, ge=0)
    transactions: int = Field(0, ge=0)


class ForecastRequest(BaseModel):
    history: list[DayHistory] = Field(..., min_length=1, max_length=400)
    horizon: int = Field(7, ge=1, le=14)


class Prediction(BaseModel):
    date: str
    sales: int
    cups: int


class ForecastResponse(BaseModel):
    predictions: list[Prediction]
    summary: dict[str, int]
    model_name: str
    metrics: dict[str, Any] = {}
    is_fallback: bool


class InsightRequest(BaseModel):
    period: dict[str, str] = Field(..., examples=[{"from": "2026-11-01", "to": "2026-11-12"}])
    totals: dict[str, Any]
    previous_totals: dict[str, Any] | None = None
    change_pct: dict[str, float | None] = {}
    top_products: list[dict[str, Any]] = []
    least_products: list[dict[str, Any]] = []
    expense_by_category: list[dict[str, Any]] = []
    payments: dict[str, Any] = {}


class InsightResponse(BaseModel):
    insight: str
    recommendations: list[str]
    model: str
    is_fallback: bool


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=500, examples=["Berapa penjualan hari ini?"])
    context: dict[str, Any] = {}


class ChatResponse(BaseModel):
    intent: str
    confidence: float
    reply: str
    escalate: bool = False
    model: str
    is_fallback: bool


# ---------- endpoints ----------
@app.get("/", tags=["health"])
def health():
    return {"service": "coffee-service-ai", "status": "ok", "llm": llm.GEMINI_MODEL if llm.is_configured() else "fallback-only", "intents": INTENTS}


@app.post("/predict-sales", response_model=ForecastResponse, tags=["machine-learning"])
def predict_sales(req: ForecastRequest):
    result = forecast.predict([h.model_dump() for h in req.history], req.horizon)
    preds = [
        Prediction(date=p["date"], sales=max(int(round(p["sales"] / 1000) * 1000), 0), cups=max(int(round(p["cups"])), 0))
        for p in result["predictions"]
    ]
    metrics = {k: (round(v) if isinstance(v, float) else v) for k, v in (result.get("metrics") or {}).items()}
    return ForecastResponse(
        predictions=preds,
        summary={"total_sales": sum(p.sales for p in preds), "total_cups": sum(p.cups for p in preds)},
        model_name=result["model_name"],
        metrics=metrics,
        is_fallback=result["is_fallback"],
    )


def fallback_insight(req: InsightRequest) -> tuple[str, list[str]]:
    t = req.totals
    ch = req.change_pct or {}
    if not t.get("transactions") and not t.get("expense"):
        return (
            "Kak, belum ada transaksi maupun pengeluaran yang tercatat di periode ini.",
            ["Mulai catat setiap penjualan di halaman Penjualan agar rekap terisi otomatis."],
        )
    parts = [f"Kak, total pemasukan periode ini {rp_short(t.get('income'))}"]
    if ch.get("income") is not None:
        parts[0] += f", {pct_text(ch.get('income'))}"
    parts[0] += "."
    parts.append(f"Pengeluaran {rp_short(t.get('expense'))}, sehingga saldo bersih {rp_short(t.get('net'))}.")
    if req.top_products:
        top = req.top_products[0]
        parts.append(f"Menu terlaris {top['name']} ({top['qty']} cup) dari total {t.get('cups', 0)} cup terjual.")

    recs: list[str] = []
    if (t.get("net") or 0) < 0:
        big = req.expense_by_category[0]["category"] if req.expense_by_category else "pengeluaran"
        recs.append(f"Saldo masih minus — tinjau pos {big} dan pastikan penjualan harian menutup biaya tetap.")
    if ch.get("income") is not None and ch["income"] < 0:
        recs.append("Pemasukan turun: coba promo jam sepi atau paket hemat 2 minuman.")
    if req.top_products:
        recs.append(f"Jaga stok bahan {req.top_products[0]['name']} karena paling banyak dicari.")
    if req.least_products and len(req.top_products) >= 3:
        recs.append(f"Promosikan {req.least_products[-1]['name']} lewat Instagram/TikTok atau evaluasi menunya.")
    if not recs:
        recs.append("Pertahankan pencatatan harian agar tren penjualan mudah dipantau.")
    return " ".join(parts), recs[:3]


@app.post("/generate-insight", response_model=InsightResponse, tags=["gen-ai"])
def generate_insight(req: InsightRequest):
    data = req.model_dump()
    prompt = f"{INSIGHT_FEWSHOT}\n\nData periode {req.period.get('from')} s/d {req.period.get('to')}:\n{json.dumps(data, ensure_ascii=False)}"
    try:
        raw = llm.generate(prompt, INSIGHT_SYSTEM, json_mode=True, temperature=0.4)
        parsed = json.loads(raw)
        insight = str(parsed.get("insight", "")).strip()
        recs = [str(r).strip() for r in parsed.get("recommendations", []) if str(r).strip()][:3]
        if not insight:
            raise ValueError("insight kosong")
        return InsightResponse(insight=insight, recommendations=recs, model=llm.GEMINI_MODEL, is_fallback=False)
    except (llm.LlmUnavailable, ValueError, json.JSONDecodeError) as exc:
        logging.getLogger("insight").info("fallback: %s", exc)
        insight, recs = fallback_insight(req)
        return InsightResponse(insight=insight, recommendations=recs, model="template", is_fallback=True)


def fallback_chat(intent: str, ctx: dict[str, Any]) -> str:
    today = ctx.get("today", {}).get("totals", {})
    month = ctx.get("this_month", {}).get("totals", {})
    top = ctx.get("this_month", {}).get("top_products", [])
    exp = ctx.get("this_month", {}).get("expense_by_category", [])
    if intent == "tanya_penjualan":
        return (
            f"Hari ini: penjualan {rp(today.get('sales'))} dari {today.get('transactions', 0)} transaksi "
            f"({today.get('cups', 0)} cup), pengeluaran {rp(today.get('expense'))}.\n"
            f"Bulan ini: pemasukan {rp(month.get('income'))}, pengeluaran {rp(month.get('expense'))}, "
            f"saldo bersih {rp(month.get('net'))}."
        )
    if intent == "tanya_produk":
        if not top:
            return "Belum ada penjualan menu bulan ini."
        lines = [f"{i + 1}. {p['name']} — {p['qty']} cup ({rp(p['sales'])})" for i, p in enumerate(top[:5])]
        return "Menu terlaris bulan ini:\n" + "\n".join(lines)
    if intent == "minta_saran":
        recs = []
        if top:
            recs.append(f"• Tonjolkan {top[0]['name']} sebagai menu andalan di Instagram/TikTok.")
        if exp:
            recs.append(f"• Pengeluaran terbesar bulan ini: {exp[0]['category']} ({rp(exp[0]['amount'])}) — cek apakah bisa dihemat.")
        recs.append("• Buat paket hemat 2 minuman di jam sepi untuk menaikkan jumlah cup.")
        return "Beberapa saran:\n" + "\n".join(recs)
    if intent == "keluhan":
        return "Terima kasih sudah menyampaikan, Kak. Keluhan ini sudah dicatat dan akan diteruskan ke pemilik untuk ditindaklanjuti."
    return REFUSAL


@app.post("/chat", response_model=ChatResponse, tags=["gen-ai"])
def chat(req: ChatRequest):
    intent, conf = classify(req.message)
    escalate = intent == "keluhan"

    # Guardrail: pertanyaan di luar konteks langsung ditolak tanpa memanggil LLM
    if intent == "di_luar_konteks":
        return ChatResponse(intent=intent, confidence=conf, reply=REFUSAL, escalate=False, model="guardrail", is_fallback=False)

    prompt = (
        f"KONTEKS DATA (JSON):\n{json.dumps(req.context, ensure_ascii=False)}\n\n"
        f"Intent terdeteksi: {intent}\nPertanyaan: {req.message}"
    )
    try:
        reply = llm.generate(prompt, CHAT_SYSTEM, temperature=0.5, max_tokens=400)
        return ChatResponse(intent=intent, confidence=conf, reply=reply, escalate=escalate, model=llm.GEMINI_MODEL, is_fallback=False)
    except llm.LlmUnavailable as exc:
        logging.getLogger("chat").info("fallback: %s", exc)
        return ChatResponse(
            intent=intent, confidence=conf, reply=fallback_chat(intent, req.context), escalate=escalate, model="template", is_fallback=True,
        )
