"""Central logging setup for API Agent."""
import logging
import os
import sys
from pathlib import Path

_BARRICADE_ROOT = Path(__file__).resolve().parent.parent
if str(_BARRICADE_ROOT) not in sys.path:
    sys.path.insert(0, str(_BARRICADE_ROOT))

from barricade_colored_logging import setup_colored_root_logging


class _UvicornWebSocketNoiseFilter(logging.Filter):
    """Drop routine WebSocket lines on uvicorn.error; keep startup and real errors."""

    def filter(self, record: logging.LogRecord) -> bool:
        msg = record.getMessage()
        if '"WebSocket' in msg and "[accepted]" in msg:
            return False
        s = msg.strip()
        if s in ("connection open", "connection closed"):
            return False
        return True


def configure_logging() -> None:
    level_name = os.getenv("LOG_LEVEL", "INFO").upper()
    level = getattr(logging, level_name, logging.INFO)

    setup_colored_root_logging(
        "api_agent",
        level=level,
        fmt="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    # Quieter third-party loggers
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("uvicorn").setLevel(logging.INFO)
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    uv_err = logging.getLogger("uvicorn.error")
    uv_err.setLevel(logging.INFO)
    if not any(
        isinstance(f, _UvicornWebSocketNoiseFilter) for f in uv_err.filters
    ):
        uv_err.addFilter(_UvicornWebSocketNoiseFilter())
    # Per-connection open (uvicorn uses websockets library)
    logging.getLogger("websockets.server").setLevel(logging.WARNING)
