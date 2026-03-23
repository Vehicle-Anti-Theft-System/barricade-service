"""WebSocket endpoint: verification events and commands (CONTEXT.MD)."""
import json
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from api_agent.core import get_manager
from api_agent.core.events import (
    CMD_MANUAL_PLATE,
    CMD_OPEN_GATE,
    CMD_SESSION_RESET,
    CMD_SIMULATE,
    CMD_START_VERIFICATION,
    EVENT_SESSION_RESET,
)
from api_agent.services.session import get_session
from api_agent.services.verification import (
    event_message,
    open_gate_live,
    run_mock_verification,
    verify_manual_plate,
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.websocket("/ws")
async def websocket_endpoint(ws: WebSocket) -> None:
    manager = get_manager()
    await manager.connect(ws)
    try:
        await manager.send_to(ws, event_message(EVENT_SESSION_RESET))
        logger.debug("Sent initial session_reset to new WebSocket client")

        while True:
            raw = await ws.receive_text()
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                logger.debug("Ignoring non-JSON WebSocket message (len=%s)", len(raw))
                continue
            event = data.get("event") or data.get("command")
            if not event:
                logger.debug("Ignoring message with no event/command")
                continue

            logger.info("WebSocket inbound: %s", event)

            if event in (CMD_SIMULATE, CMD_START_VERIFICATION):
                auto_open = data.get("auto_open", True)
                employee_id = data.get("employee_id") or None
                logger.info(
                    "simulate/start_verification: auto_open=%s employee_id=%s",
                    auto_open,
                    "set" if employee_id else "none",
                )
                await run_mock_verification(ws, auto_open=auto_open, employee_id=employee_id)

            elif event == CMD_SESSION_RESET:
                logger.info("session_reset: clearing verification session")
                get_session().reset()
                await manager.broadcast(event_message(EVENT_SESSION_RESET))

            elif event == CMD_MANUAL_PLATE:
                plate = (data.get("plate") or "").strip().upper()
                if plate:
                    logger.info("manual_plate: plate length=%s", len(plate))
                    await verify_manual_plate(plate)
                else:
                    logger.warning("manual_plate: empty plate ignored")

            elif event == CMD_OPEN_GATE:
                logger.info("open_gate command from WebSocket")
                await open_gate_live(method="manual")

    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected")
    finally:
        manager.disconnect(ws)
