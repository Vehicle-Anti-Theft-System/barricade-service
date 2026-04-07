"""
Edge device configuration — camera source & RFID serial port.

Persisted as ``barricade_config.json`` next to the project root so all
barricade-service processes can read it.  The dashboard writes via
``PUT /config`` and reads via ``GET /config``.
"""

import json
import logging
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/config", tags=["config"])

_CONFIG_PATH = Path(__file__).resolve().parents[2] / "barricade_config.json"

_DEFAULTS: dict[str, Any] = {
    "camera": {
        "type": "usb",
        "usb_index": 0,
        "network_url": "",
        "resolution_width": 1280,
        "resolution_height": 720,
    },
    "rfid": {
        "mode": "mock",
        "com_port": "",
        "baud_rate": 9600,
        "api_agent_ingest_url": "http://localhost:8080/rfid/scan",
    },
}


class CameraConfig(BaseModel):
    type: str = Field("usb", pattern="^(usb|network)$", description="'usb' or 'network'")
    usb_index: int = Field(0, ge=0, le=20)
    network_url: str = Field("", max_length=512, description="RTSP / HTTP MJPEG URL for IP cameras")
    resolution_width: int = Field(1280, ge=320, le=3840)
    resolution_height: int = Field(720, ge=240, le=2160)


class RFIDConfig(BaseModel):
    mode: str = Field("mock", pattern="^(mock|serial)$", description="'mock' or 'serial'")
    com_port: str = Field("", max_length=64, description="e.g. COM3, /dev/ttyUSB0")
    baud_rate: int = Field(9600, ge=300, le=115200)
    api_agent_ingest_url: str = Field("http://localhost:8080/rfid/scan", max_length=512)


class BarricadeConfig(BaseModel):
    camera: CameraConfig = Field(default_factory=CameraConfig)
    rfid: RFIDConfig = Field(default_factory=RFIDConfig)


def _read_config() -> dict[str, Any]:
    if _CONFIG_PATH.exists():
        try:
            raw = json.loads(_CONFIG_PATH.read_text(encoding="utf-8"))
            merged = {**_DEFAULTS}
            for section in ("camera", "rfid"):
                merged[section] = {**_DEFAULTS[section], **(raw.get(section) or {})}
            return merged
        except Exception as exc:
            logger.warning("Failed to read %s, returning defaults: %s", _CONFIG_PATH, exc)
    return {**_DEFAULTS}


def _write_config(data: dict[str, Any]) -> None:
    _CONFIG_PATH.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    logger.info("Config written to %s", _CONFIG_PATH)


@router.get("", response_model=BarricadeConfig)
async def get_config():
    """Return the current edge device configuration."""
    return _read_config()


@router.put("", response_model=BarricadeConfig)
async def update_config(body: BarricadeConfig):
    """Persist updated edge device configuration."""
    data = body.model_dump()
    if data["camera"]["type"] == "network" and not data["camera"]["network_url"].strip():
        raise HTTPException(
            status_code=422,
            detail="network_url is required when camera type is 'network'",
        )
    if data["rfid"]["mode"] == "serial" and not data["rfid"]["com_port"].strip():
        raise HTTPException(
            status_code=422,
            detail="com_port is required when RFID mode is 'serial'",
        )
    _write_config(data)
    return data
