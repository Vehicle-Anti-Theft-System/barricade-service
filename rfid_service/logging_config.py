"""Logging setup for RFID service."""
import logging
import os
import sys
from pathlib import Path

_BARRICADE_ROOT = Path(__file__).resolve().parent.parent
if str(_BARRICADE_ROOT) not in sys.path:
    sys.path.insert(0, str(_BARRICADE_ROOT))

from barricade_colored_logging import setup_colored_root_logging


def configure_logging() -> None:
    level_name = os.getenv("LOG_LEVEL", "INFO").upper()
    level = getattr(logging, level_name, logging.INFO)

    setup_colored_root_logging(
        "rfid",
        level=level,
        fmt="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.access").setLevel(logging.INFO)
