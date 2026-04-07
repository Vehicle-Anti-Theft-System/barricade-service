"""WebSocket connection manager."""
import json
import logging
from typing import List

from fastapi import WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self) -> None:
        self.connections: List[WebSocket] = []

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self.connections.append(ws)
        logger.debug("WebSocket connected (active clients: %d)", len(self.connections))

    def disconnect(self, ws: WebSocket) -> None:
        if ws in self.connections:
            self.connections.remove(ws)
            logger.debug("WebSocket disconnected (active clients: %d)", len(self.connections))

    async def send_to(self, ws: WebSocket, payload: dict) -> None:
        # Do not swallow WebSocketDisconnect: Starlette may mark the socket DISCONNECTED
        # before raising; swallowing it leaves a dead socket and the next receive_text()
        # raises RuntimeError('Need to call "accept" first.').
        await ws.send_text(json.dumps(payload))

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
            try:
                await self.send_to(connection, payload)
            except WebSocketDisconnect:
                self.disconnect(connection)
            except Exception as exc:
                logger.warning("WebSocket broadcast: dropping client after send error: %s", exc)
                self.disconnect(connection)


_manager: ConnectionManager | None = None


def get_manager() -> ConnectionManager:
    global _manager
    if _manager is None:
        _manager = ConnectionManager()
    return _manager
