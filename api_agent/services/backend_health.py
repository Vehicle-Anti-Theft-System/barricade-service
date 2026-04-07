"""
Poll central backend `GET /health/live` and push status to dashboards over WebSocket.

The dashboard does not call the backend URL directly for liveness — the API Agent
is the single place that probes `BACKEND_BASE_URL`.
"""
from __future__ import annotations

import asyncio
import logging

import httpx

from api_agent.config import backend_base_url
from api_agent.core import get_manager
from api_agent.core.events import EVENT_BACKEND_HEALTH

logger = logging.getLogger(__name__)

POLL_INTERVAL_SEC = 10.0
TIMEOUT_SEC = 5.0

_last_ok: bool | None = None


async def probe_backend_live() -> bool:
    url = f"{backend_base_url()}/health/live"
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT_SEC) as client:
            r = await client.get(url)
        return r.is_success
    except httpx.RequestError as e:
        logger.debug("Backend health/live unreachable: %s", e)
        return False


def _payload(connected: bool) -> dict:
    return {"event": EVENT_BACKEND_HEALTH, "connected": connected}


async def send_backend_health_to_client(ws) -> None:
    """Send current backend liveness to one WebSocket (e.g. on connect)."""
    manager = get_manager()
    ok = await probe_backend_live()
    await manager.send_to(ws, _payload(ok))


async def backend_health_loop() -> None:
    """Background: poll backend and broadcast when status changes."""
    global _last_ok
    while True:
        try:
            ok = await probe_backend_live()
            if ok != _last_ok or _last_ok is None:
                _last_ok = ok
                manager = get_manager()
                await manager.broadcast(_payload(ok))
                logger.info("Backend health broadcast: connected=%s", ok)
            await asyncio.sleep(POLL_INTERVAL_SEC)
        except asyncio.CancelledError:
            logger.debug("backend_health_loop cancelled")
            raise
        except Exception as e:
            logger.warning("backend_health_loop error: %s", e)
            await asyncio.sleep(POLL_INTERVAL_SEC)
