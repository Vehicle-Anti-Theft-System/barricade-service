"""
Verification pipelines — mock and live ANPR flow.

Mock: simulates RFID → ANPR → gate with delays (for demo / testing).
Live: captures from ANPR service, verifies via backend, broadcasts results.
"""
import asyncio
import logging
from typing import Any

import httpx
from fastapi import WebSocket

from api_agent.config import (
    ANPR_MAX_RETRIES,
    ANPR_RETRY_DELAY,
    anpr_service_url,
    default_barricade_id,
)
from api_agent.core import get_manager
from api_agent.core.events import (
    EVENT_ANPR_MANUAL,
    EVENT_ANPR_PROCESSING,
    EVENT_ANPR_RESULT,
    EVENT_ANPR_RETRY,
    EVENT_GATE_DECISION,
    EVENT_RFID_CHECK_RESULT,
    EVENT_RFID_SCANNING,
)
from api_agent.services.backend_client import BackendRequestError, backend_post_json
from api_agent.services.session import get_session

logger = logging.getLogger(__name__)


def event_message(event: str, **kwargs: Any) -> dict:
    """Build a WebSocket message: { event, ...payload }."""
    return {"event": event, **kwargs}


# ---------------------------------------------------------------------------
# Mock verification (simulate button / demo)
# ---------------------------------------------------------------------------

async def run_mock_verification(
    ws: WebSocket, *, auto_open: bool = True, employee_id: str | None = None
) -> None:
    """Run a single mock verification flow: RFID → ANPR → gate."""
    _ = employee_id
    logger.info("Mock verification started (auto_open=%s)", auto_open)
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
    logger.info("Mock verification finished")


# ---------------------------------------------------------------------------
# Live ANPR pipeline (triggered after RFID validates via /rfid/scan)
# ---------------------------------------------------------------------------

async def _capture_plate() -> dict:
    """Call ANPR service POST /capture and return JSON response."""
    url = f"{anpr_service_url()}/capture"
    logger.debug("HTTP POST %s", url)
    async with httpx.AsyncClient(timeout=20.0) as client:
        r = await client.post(url)
        r.raise_for_status()
        data = r.json()
        plate = data.get("plate")
        conf = data.get("confidence")
        logger.info(
            "ANPR /capture OK plate=%s confidence=%s",
            plate or "(none)",
            f"{conf:.2f}" if isinstance(conf, (int, float)) else conf,
        )
        logger.debug("ANPR /capture raw: %s", data)
        return data


async def _verify_anpr_with_backend(rfid_tag: str, plate: str, barricade_id: str) -> dict:
    """Call backend POST /api/verify/anpr (retries + API key via backend_client)."""
    payload = {
        "rfid_tag": rfid_tag,
        "plate_detected": plate,
        "barricade_id": barricade_id,
    }
    logger.debug("Backend POST /api/verify/anpr (rfid_tag=%s plate=%s)", rfid_tag, plate)
    data = await backend_post_json("/api/verify/anpr", payload)
    logger.debug("Backend /verify/anpr response status field: %s", data.get("status"))
    return data


async def _open_gate_backend(
    order_id: str, barricade_id: str, rfid_tag: str, plate: str, method: str = "auto"
) -> dict:
    """Call backend POST /api/verify/gate-open."""
    payload = {
        "order_id": order_id,
        "barricade_id": barricade_id,
        "rfid_tag": rfid_tag,
        "plate_detected": plate,
        "gate_method": method,
    }
    logger.info("Backend POST /api/verify/gate-open (order_id=%s method=%s)", order_id, method)
    data = await backend_post_json("/api/verify/gate-open", payload)
    if data.get("status") != "ok":
        detail = data.get("detail") or data.get("status") or "gate-open rejected"
        raise BackendRequestError(
            str(detail),
            status_code=200,
            body=data,
        )
    if data.get("duplicate"):
        logger.info(
            "Backend gate-open idempotent: entry_log_id=%s",
            data.get("entry_log_id"),
        )
    else:
        logger.info("Backend gate-open ok: entry_log_id=%s", data.get("entry_log_id"))
    return data


async def run_anpr_pipeline() -> None:
    """
    Capture plate from ANPR service, verify with backend, broadcast results.
    Called as a background task after RFID validates.
    Retries ANPR capture up to ANPR_MAX_RETRIES times before requesting manual entry.
    """
    logger.info("ANPR pipeline started (retries=%s, delay=%ss)", ANPR_MAX_RETRIES, ANPR_RETRY_DELAY)
    manager = get_manager()
    session = get_session()
    msg = event_message
    barricade_id = default_barricade_id()

    await manager.broadcast(msg(EVENT_ANPR_PROCESSING))
    await asyncio.sleep(0.5)

    plate = None
    confidence = 0.0

    for attempt in range(1, ANPR_MAX_RETRIES + 1):
        try:
            data = await _capture_plate()
            plate = data.get("plate")
            confidence = data.get("confidence", 0.0)
            if plate:
                logger.info("ANPR capture attempt %d: plate=%s conf=%.2f", attempt, plate, confidence)
                break
            logger.info("ANPR capture attempt %d: no plate detected", attempt)
        except Exception as exc:
            logger.warning("ANPR capture attempt %d failed: %s", attempt, exc)

        if attempt < ANPR_MAX_RETRIES:
            await manager.broadcast(msg(EVENT_ANPR_RETRY, attempt=attempt))
            await asyncio.sleep(ANPR_RETRY_DELAY)

    if not plate:
        logger.warning("ANPR pipeline: no plate after %d attempts; requesting manual entry", ANPR_MAX_RETRIES)
        await manager.broadcast(msg(EVENT_ANPR_MANUAL))
        return

    if not barricade_id or not session.rfid_tag:
        logger.info("ANPR result without backend verify (plate=%s barricade_id=%s)", plate, bool(barricade_id))
        await manager.broadcast(
            msg(EVENT_ANPR_RESULT, status="VALIDATED", plate=plate, confidence=confidence)
        )
        return

    try:
        anpr_result = await _verify_anpr_with_backend(session.rfid_tag, plate, barricade_id)
    except BackendRequestError as exc:
        logger.error("Backend ANPR verify failed: %s", exc)
        await manager.broadcast(
            msg(EVENT_ANPR_RESULT, status="FAILED", plate=plate, detail=f"Backend error: {exc}")
        )
        return

    status = anpr_result.get("status", "FAILED")
    ws_payload = {
        "event": EVENT_ANPR_RESULT,
        "status": status,
        "plate": plate,
        "confidence": confidence,
    }
    if status != "VALIDATED":
        ws_payload["detail"] = anpr_result.get("detail", "Plate mismatch")
        ws_payload["expected_plate"] = anpr_result.get("expected_plate")
        ws_payload["alert_type"] = anpr_result.get("alert_type")

    await manager.broadcast(ws_payload)

    if status == "VALIDATED":
        session.plate_detected = plate
        session.anpr_validated = True

        if session.order_id:
            try:
                await _open_gate_backend(
                    session.order_id, barricade_id, session.rfid_tag, plate, "auto"
                )
            except BackendRequestError as exc:
                logger.error("Backend gate-open failed: %s", exc)
            except Exception as exc:
                logger.error("Backend gate-open failed: %s", exc)

        await asyncio.sleep(0.3)
        await manager.broadcast(msg(EVENT_GATE_DECISION, open=True, method="auto"))
        logger.info("ANPR pipeline complete (VALIDATED plate=%s)", plate)
    else:
        logger.info("ANPR pipeline complete (FAILED status=%s)", status)


async def verify_manual_plate(plate: str) -> None:
    """Verify a manually entered plate against the current session's RFID context."""
    logger.info("Manual plate verification submitted (plate=%s)", plate)
    manager = get_manager()
    session = get_session()
    msg = event_message
    barricade_id = default_barricade_id()

    if not session.rfid_tag or not barricade_id:
        logger.warning(
            "Manual plate: skipping backend (no session rfid or DEFAULT_BARRICADE_ID); "
            "broadcasting VALIDATED to UI only"
        )
        await manager.broadcast(
            msg(EVENT_ANPR_RESULT, status="VALIDATED", plate=plate, confidence=1.0)
        )
        return

    try:
        anpr_result = await _verify_anpr_with_backend(session.rfid_tag, plate, barricade_id)
    except BackendRequestError as exc:
        logger.error("Backend ANPR verify (manual) failed: %s", exc)
        await manager.broadcast(
            msg(EVENT_ANPR_RESULT, status="FAILED", plate=plate, detail=f"Backend error: {exc}")
        )
        return

    status = anpr_result.get("status", "FAILED")
    ws_payload = {
        "event": EVENT_ANPR_RESULT,
        "status": status,
        "plate": plate,
        "confidence": 1.0,
    }
    if status != "VALIDATED":
        ws_payload["detail"] = anpr_result.get("detail", "Plate mismatch")
        ws_payload["expected_plate"] = anpr_result.get("expected_plate")

    await manager.broadcast(ws_payload)

    if status == "VALIDATED":
        session.plate_detected = plate
        session.anpr_validated = True

        if session.order_id:
            try:
                await _open_gate_backend(
                    session.order_id, barricade_id, session.rfid_tag, plate, "manual"
                )
            except BackendRequestError as exc:
                logger.error("Backend gate-open (manual) failed: %s", exc)
            except Exception as exc:
                logger.error("Backend gate-open (manual) failed: %s", exc)

        await asyncio.sleep(0.3)
        await manager.broadcast(msg(EVENT_GATE_DECISION, open=True, method="manual"))
        logger.info("Manual plate flow complete (VALIDATED)")
    else:
        logger.info("Manual plate flow complete (FAILED status=%s)", status)


async def open_gate_live(method: str = "manual") -> None:
    """Open gate by logging entry via backend for the current session."""
    logger.info("Open gate requested (method=%s)", method)
    manager = get_manager()
    session = get_session()
    msg = event_message
    barricade_id = default_barricade_id()

    if session.order_id and barricade_id and session.rfid_tag:
        plate = session.plate_detected or ""
        try:
            await _open_gate_backend(session.order_id, barricade_id, session.rfid_tag, plate, method)
        except BackendRequestError as exc:
            logger.error("Backend gate-open (manual btn) failed: %s", exc)
        except Exception as exc:
            logger.error("Backend gate-open (manual btn) failed: %s", exc)
    else:
        logger.warning(
            "Open gate (manual): incomplete session — order_id=%s barricade_id=%s rfid_tag=%s "
            "(broadcasting UI only, no backend gate-open)",
            bool(session.order_id),
            bool(barricade_id),
            bool(session.rfid_tag),
        )

    await manager.broadcast(msg(EVENT_GATE_DECISION, open=True, method=method))
    logger.info("Broadcast gate_decision open=True method=%s", method)
