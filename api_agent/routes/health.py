"""Health and readiness."""
import logging

from fastapi import APIRouter

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/health")
def health() -> dict:
    logger.debug("GET /health")
    return {"status": "ok", "service": "api-agent"}
