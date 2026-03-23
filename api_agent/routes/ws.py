"""WebSocket endpoint: verification events and commands (CONTEXT.MD)."""
import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from api_agent.core import get_manager
from api_agent.core.events import (
    CMD_MANUAL_PLATE,
    CMD_OPEN_GATE,
    CMD_SESSION_RESET,
    CMD_SIMULATE,
    CMD_START_VERIFICATION,
    EVENT_ANPR_RESULT,
    EVENT_GATE_DECISION,
    EVENT_SESSION_RESET,
)
from api_agent.services.verification import event_message, run_mock_verification

router = APIRouter()


@router.websocket("/ws")
async def websocket_endpoint(ws: WebSocket) -> None:
    manager = get_manager()
    await manager.connect(ws)
    try:
        await manager.send_to(ws, event_message(EVENT_SESSION_RESET))

        while True:
            raw = await ws.receive_text()
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                continue
            event = data.get("event") or data.get("command")
            if not event:
                continue

            if event in (CMD_SIMULATE, CMD_START_VERIFICATION):
                auto_open = data.get("auto_open", True)
                employee_id = data.get("employee_id") or None
                await run_mock_verification(ws, auto_open=auto_open, employee_id=employee_id)

            elif event == CMD_SESSION_RESET:
                await manager.broadcast(event_message(EVENT_SESSION_RESET))

            elif event == CMD_MANUAL_PLATE:
                plate = (data.get("plate") or "").strip().upper()
                if plate:
                    await manager.send_to(
                        ws,
                        event_message(
                            EVENT_ANPR_RESULT,
                            status="VALIDATED",
                            plate=plate,
                            confidence=1.0,
                        ),
                    )

            elif event == CMD_OPEN_GATE:
                await manager.send_to(
                    ws,
                    event_message(EVENT_GATE_DECISION, open=True, method="manual"),
                )

    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(ws)
