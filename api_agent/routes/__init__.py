"""API routes: root, health, WebSocket."""
from fastapi import APIRouter

from api_agent.routes import health, root, ws

router = APIRouter()
router.include_router(root.router, tags=["root"])
router.include_router(health.router, tags=["health"])
router.include_router(ws.router, tags=["websocket"])

__all__ = ["router"]
