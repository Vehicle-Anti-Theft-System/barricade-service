"""API routes: root, health, WebSocket, config, backend proxy."""
from fastapi import APIRouter

from api_agent.routes import config, health, proxy, rfid_scan, root, ws

router = APIRouter()
router.include_router(root.router, tags=["root"])
router.include_router(health.router, tags=["health"])
router.include_router(rfid_scan.router, tags=["rfid"])
router.include_router(ws.router, tags=["websocket"])
router.include_router(config.router, tags=["config"])
router.include_router(proxy.router, tags=["proxy"])

__all__ = ["router"]
