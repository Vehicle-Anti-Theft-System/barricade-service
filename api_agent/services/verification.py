"""Verification flow: mock RFID → ANPR → gate (2-factor: RFID + ANPR only)."""
import asyncio
from typing import Any

from fastapi import WebSocket

from api_agent.core import get_manager
from api_agent.core.events import (
    EVENT_ANPR_PROCESSING,
    EVENT_ANPR_RESULT,
    EVENT_GATE_DECISION,
    EVENT_RFID_CHECK_RESULT,
    EVENT_RFID_SCANNING,
)


def event_message(event: str, **kwargs: Any) -> dict:
    """Build a WebSocket message: { event, ...payload }."""
    return {"event": event, **kwargs}


async def run_mock_verification(ws: WebSocket, *, auto_open: bool = True, employee_id: str | None = None) -> None:
    """Run a single mock verification flow: RFID → ANPR → gate.
    employee_id: logged-in barricade employee (passed when backend is wired; stored on alerts).
    """
    _ = employee_id  # reserved for backend-wired flow
    manager = get_manager()
    msg = event_message
    delays = {
        "rfid_scan": 0.3,
        "rfid_result": 1.2,
        "anpr_process": 0.5,
        "anpr_result": 1.0,
        "gate": 0.3,
    }

    await manager.send_to(ws, msg(EVENT_RFID_SCANNING))
    await asyncio.sleep(delays["rfid_scan"])

    await manager.send_to(
        ws,
        msg(
            EVENT_RFID_CHECK_RESULT,
            status="VALIDATED",
            rfid="8829-4471-001",
            truck_id="TRK-047",
            order_id="ORD-2024-891",
            driver_name="Amit Kumar",
        ),
    )
    await asyncio.sleep(delays["rfid_result"])

    await manager.send_to(ws, msg(EVENT_ANPR_PROCESSING))
    await asyncio.sleep(delays["anpr_process"])

    await manager.send_to(
        ws,
        msg(
            EVENT_ANPR_RESULT,
            status="VALIDATED",
            plate="MH12AB4821",
            confidence=0.98,
        ),
    )
    await asyncio.sleep(delays["anpr_result"])

    if auto_open:
        await manager.send_to(ws, msg(EVENT_GATE_DECISION, open=True, method="auto"))
    await asyncio.sleep(delays["gate"])
