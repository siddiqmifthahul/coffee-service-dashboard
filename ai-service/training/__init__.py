import sys

# Konsol Windows default cp1252 tidak bisa menampilkan simbol seperti ✓ / →
for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8")
    except Exception:  # noqa: BLE001
        pass
