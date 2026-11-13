# Entry point serverless untuk Vercel (Python runtime, ASGI).
# Semua request di-rewrite ke sini (lihat vercel.json) lalu ditangani aplikasi FastAPI yang sama.
from app.main import app  # noqa: F401
