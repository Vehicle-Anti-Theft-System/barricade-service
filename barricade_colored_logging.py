"""
ANSI line colors for barricade Python services when stdout is a TTY.
Respect NO_COLOR (https://no-color.org/).
"""
from __future__ import annotations

import logging
import os
import sys

RESET = "\033[0m"

# anpr: pink (bright magenta), api_agent: green, rfid: blue
SERVICE_LINE_PREFIX = {
    "anpr": "\033[95m",
    "api_agent": "\033[92m",
    "rfid": "\033[94m",
}


def color_enabled() -> bool:
    return bool(sys.stdout.isatty() and not os.environ.get("NO_COLOR", "").strip())


class BarricadeColorFormatter(logging.Formatter):
    """Wrap entire log line in one service color."""

    def __init__(self, service_key: str, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._prefix = SERVICE_LINE_PREFIX.get(service_key, "") if color_enabled() else ""
        self._reset = RESET if self._prefix else ""

    def format(self, record: logging.LogRecord) -> str:
        line = super().format(record)
        if not self._prefix:
            return line
        return f"{self._prefix}{line}{self._reset}"


def setup_colored_root_logging(
    service_key: str,
    *,
    level: int = logging.INFO,
    fmt: str = "%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt: str = "%Y-%m-%d %H:%M:%S",
) -> None:
    handler = logging.StreamHandler()
    handler.setFormatter(BarricadeColorFormatter(service_key, fmt, datefmt))
    logging.basicConfig(level=level, handlers=[handler], force=True)
