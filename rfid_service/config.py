"""RFID service settings — push-only to API Agent (no inbound data from agent).

Precedence: environment variable > barricade_config.json > built-in default.
barricade_config.json is looked up at the barricade-service workspace root.
"""
import json
import logging
import os
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)


def config_file_path() -> Path | None:
    """Return the location of barricade_config.json, or None if not found."""
    here = Path(__file__).resolve()
    for parent in (here.parent.parent, here.parent.parent.parent):
        cand = parent / "barricade_config.json"
        if cand.exists():
            return cand
    return None


def _load_barricade_config() -> dict:
    cand = config_file_path()
    if cand is None:
        return {}
    try:
        with cand.open("r", encoding="utf-8") as f:
            return json.load(f) or {}
    except (json.JSONDecodeError, OSError) as e:
        logger.warning("Could not read %s: %s", cand, e)
        return {}


def _rfid_cfg(key: str, default: Any = None) -> Any:
    return _load_barricade_config().get("rfid", {}).get(key, default)


def api_agent_ingest_url() -> str:
    """POST target: API Agent `POST /rfid/scan` (full URL)."""
    env = os.getenv("API_AGENT_RFID_INGEST_URL")
    value = env or _rfid_cfg("api_agent_ingest_url") or "http://localhost:8080/rfid/scan"
    return str(value).rstrip("/")


def rfid_mode() -> str:
    """'serial' for Arduino/hardware reads, 'mock' for local dev trigger."""
    value = os.getenv("RFID_MODE") or _rfid_cfg("mode") or "mock"
    return str(value).strip().lower()


def rfid_serial_port() -> str:
    """Absolute serial device path. Empty = try auto-detect (Arduino VID/PID)."""
    return (os.getenv("RFID_SERIAL_PORT") or _rfid_cfg("com_port") or "").strip()


def rfid_baud_rate() -> int:
    value = os.getenv("RFID_BAUD_RATE") or _rfid_cfg("baud_rate") or 9600
    try:
        return int(value)
    except (TypeError, ValueError):
        logger.warning("Invalid RFID baud rate %r, defaulting to 9600", value)
        return 9600
