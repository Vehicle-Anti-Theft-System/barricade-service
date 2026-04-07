"""Root and API info."""
import logging

from fastapi import APIRouter
from starlette.responses import Response

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/favicon.ico", include_in_schema=False)
def favicon():
    return Response(status_code=204)


@router.get("/")
def root() -> dict:
    logger.debug("GET /")
    return {
        "service": "Barricade API Agent",
        "docs": "/docs",
        "health": "/health",
        "ws": "ws://localhost:8080/ws",
        "rfid_ingest": "POST /rfid/scan — body { rfid_tag } from local RFID service (one-way)",
    }
