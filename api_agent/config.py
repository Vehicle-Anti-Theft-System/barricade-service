"""API Agent settings (env)."""
import os


def backend_base_url() -> str:
    return os.getenv("BACKEND_BASE_URL", "http://localhost:8000").rstrip("/")


def default_barricade_id() -> str | None:
    """UUID string for POST /api/verify/rfid. Set in production."""
    v = os.getenv("DEFAULT_BARRICADE_ID", "").strip()
    return v or None
