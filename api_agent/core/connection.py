"""WebSocket connection manager."""
import json
import logging
from typing import List

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self) -> None:
        self.connections: List[WebSocket] = []

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self.connections.append(ws)
        logger.info("WebSocket connected (active clients: %d)", len(self.connections))

    def disconnect(self, ws: WebSocket) -> None:
        if ws in self.connections:
            self.connections.remove(ws)
            logger.info("WebSocket disconnected (active clients: %d)", len(self.connections))

    async def send_to(self, ws: WebSocket, payload: dict) -> None:
        try:
            await ws.send_text(json.dumps(payload))
        except Exception as exc:
            logger.warning("WebSocket send_to failed: %s", exc)

    async def broadcast(self, payload: dict) -> None:
        event = payload.get("event", "?")
        n = len(self.connections)
        if n == 0:
            logger.debug(
                "Broadcast event=%s — no WebSocket clients (event dropped for lack of subscribers)",
                event,
            )
        else:
            logger.debug("Broadcast event=%s to %d client(s)", event, n)
        for connection in list(self.connections):
            await self.send_to(connection, payload)


_manager: ConnectionManager | None = None


def get_manager() -> ConnectionManager:
    global _manager
    if _manager is None:
        _manager = ConnectionManager()
    return _manager
