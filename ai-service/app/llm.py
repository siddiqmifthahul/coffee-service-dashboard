"""Pembungkus Gemini API dengan timeout, cache, dan penanganan kuota (fallback ke template)."""

from __future__ import annotations

import hashlib
import json
import logging
import os
import time

log = logging.getLogger("llm")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash").strip()
TIMEOUT_MS = int(os.getenv("GEMINI_TIMEOUT_MS", "12000"))
CACHE_TTL = int(os.getenv("CACHE_TTL_SECONDS", "600"))

_client = None
_cache: dict[str, tuple[float, str]] = {}
_cooldown_until = 0.0  # jeda setelah kena rate limit (429)


class LlmUnavailable(Exception):
    pass


def _get_client():
    global _client
    if _client is None:
        if not GEMINI_API_KEY:
            raise LlmUnavailable("GEMINI_API_KEY belum diisi")
        from google import genai
        from google.genai import types

        _client = genai.Client(api_key=GEMINI_API_KEY, http_options=types.HttpOptions(timeout=TIMEOUT_MS))
    return _client


def is_configured() -> bool:
    return bool(GEMINI_API_KEY)


def generate(prompt: str, system: str, *, json_mode: bool = False, temperature: float = 0.5, max_tokens: int = 700) -> str:
    """Panggil Gemini. Melempar LlmUnavailable bila key kosong, kuota habis, timeout, atau error lain."""
    global _cooldown_until
    if time.time() < _cooldown_until:
        raise LlmUnavailable("Sedang jeda karena batas kuota (rate limit)")

    key = hashlib.sha256(json.dumps([GEMINI_MODEL, system, prompt, json_mode]).encode()).hexdigest()
    hit = _cache.get(key)
    if hit and time.time() - hit[0] < CACHE_TTL:
        return hit[1]

    client = _get_client()
    from google.genai import types

    config = types.GenerateContentConfig(
        system_instruction=system,
        temperature=temperature,
        max_output_tokens=max_tokens,
        response_mime_type="application/json" if json_mode else "text/plain",
    )
    if "2.5-flash" in GEMINI_MODEL:
        # matikan "thinking" agar respons cepat & hemat kuota
        config.thinking_config = types.ThinkingConfig(thinking_budget=0)

    try:
        resp = client.models.generate_content(model=GEMINI_MODEL, contents=prompt, config=config)
        text = (resp.text or "").strip()
        if not text:
            raise LlmUnavailable("Respons kosong dari model")
    except LlmUnavailable:
        raise
    except Exception as exc:  # noqa: BLE001
        msg = str(exc)
        if "429" in msg or "RESOURCE_EXHAUSTED" in msg or "quota" in msg.lower():
            _cooldown_until = time.time() + 60
            raise LlmUnavailable("Batas kuota gratis Gemini tercapai") from exc
        log.warning("Gemini error: %s", msg[:300])
        raise LlmUnavailable(f"Gemini error: {msg[:120]}") from exc

    _cache[key] = (time.time(), text)
    if len(_cache) > 300:
        oldest = sorted(_cache.items(), key=lambda kv: kv[1][0])[:100]
        for k, _ in oldest:
            _cache.pop(k, None)
    return text
