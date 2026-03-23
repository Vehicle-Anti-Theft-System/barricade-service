"""API Agent settings (env)."""
import logging
import os

logger = logging.getLogger(__name__)


def backend_base_url() -> str:
    return os.getenv("BACKEND_BASE_URL", "http://localhost:8000").rstrip("/")


def anpr_service_url() -> str:
    return os.getenv("ANPR_SERVICE_URL", "http://localhost:8001").rstrip("/")


def default_barricade_id() -> str | None:
    """UUID string for POST /api/verify/rfid. Set in production."""
    v = os.getenv("DEFAULT_BARRICADE_ID", "").strip()
    return v or None


ANPR_MAX_RETRIES = int(os.getenv("ANPR_MAX_RETRIES", "3"))
ANPR_RETRY_DELAY = float(os.getenv("ANPR_RETRY_DELAY", "2.0"))


def log_effective_settings() -> None:
    """Log non-secret effective config at startup (after configure_logging)."""
    bid = default_barricade_id()
    logger.info(
        "Settings: BACKEND_BASE_URL=%s ANPR_SERVICE_URL=%s DEFAULT_BARRICADE_ID=%s "
        "ANPR_MAX_RETRIES=%s ANPR_RETRY_DELAY=%s",
        backend_base_url(),
        anpr_service_url(),
        "set" if bid else "NOT SET",
        ANPR_MAX_RETRIES,
        ANPR_RETRY_DELAY,
    )
