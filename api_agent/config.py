"""API Agent settings (env)."""
import logging
import os

logger = logging.getLogger(__name__)


def backend_base_url() -> str:
    return os.getenv("BACKEND_BASE_URL", "http://localhost:8000").rstrip("/")


def backend_api_key() -> str:
    """Must match backend `API_KEY` (sent as X-API-Key on every backend POST)."""
    return os.getenv("BACKEND_API_KEY", "").strip()


def backend_max_retries() -> int:
    return max(1, int(os.getenv("BACKEND_MAX_RETRIES", "4")))


def backend_retry_backoff_sec() -> float:
    return float(os.getenv("BACKEND_RETRY_BACKOFF_SEC", "0.6"))


def backend_http_timeout_sec() -> float:
    return float(os.getenv("BACKEND_HTTP_TIMEOUT_SEC", "25.0"))


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
        "Settings: BACKEND_BASE_URL=%s BACKEND_API_KEY=%s ANPR_SERVICE_URL=%s "
        "DEFAULT_BARRICADE_ID=%s ANPR_MAX_RETRIES=%s ANPR_RETRY_DELAY=%s "
        "BACKEND_MAX_RETRIES=%s BACKEND_HTTP_TIMEOUT_SEC=%s",
        backend_base_url(),
        "set" if backend_api_key() else "NOT SET — backend /api calls will get 401",
        anpr_service_url(),
        "set" if bid else "NOT SET",
        ANPR_MAX_RETRIES,
        ANPR_RETRY_DELAY,
        backend_max_retries(),
        backend_http_timeout_sec(),
    )
