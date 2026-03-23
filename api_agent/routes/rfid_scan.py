"""
Inbound RFID scan from the local RFID service (Arduino/serial → RFID service → here).

Unidirectional: RFID service only POSTs to this endpoint; it never receives data from API Agent.

After RFID validates, the ANPR pipeline runs as a background task:
    ANPR capture → backend verify → gate decision
"""
import asyncio
import logging
from uuid import UUID

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from api_agent.config import backend_base_url, default_barricade_id
from api_agent.core import get_manager
from api_agent.core.events import EVENT_RFID_CHECK_RESULT, EVENT_RFID_SCANNING
from api_agent.services.session import get_session
from api_agent.services.verification import event_message, run_anpr_pipeline

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/rfid", tags=["rfid"])


class RFIDScanIngest(BaseModel):
    """Payload sent only from the RFID service (one-way)."""

    rfid_tag: str = Field(..., min_length=1, description="Raw RFID / tag id read from hardware")


def _map_backend_to_ws_payload(data: dict) -> dict:
    """Map backend RFIDVerifyResponse JSON to dashboard WebSocket shape."""
    status = data.get("status", "FAILED")
    base = {
        "event": EVENT_RFID_CHECK_RESULT,
        "status": status,
        "rfid": data.get("rfid_tag") or data.get("rfid"),
    }
    if status == "VALIDATED":
        oid = data.get("order_id")
        tid = data.get("truck_id")
        base["order_id"] = str(oid) if oid is not None else None
        base["truck_id"] = str(tid) if tid is not None else None
        if data.get("driver_name"):
            base["driver_name"] = data["driver_name"]
        if data.get("expected_plate"):
            base["expected_plate"] = data["expected_plate"]
    else:
        base["rfid"] = data.get("rfid_tag") or base.get("rfid")
        if data.get("alert_type"):
            base["alert_type"] = data["alert_type"]
        if data.get("detail"):
            base["detail"] = data["detail"]
    return base


@router.post("/scan")
async def ingest_rfid_scan(body: RFIDScanIngest):
    """
    Receive a tag read from the RFID service.
    1. Broadcast rfid_scanning to dashboard.
    2. Validate via backend POST /api/verify/rfid.
    3. Broadcast rfid_check_result.
    4. If VALIDATED → launch ANPR pipeline as background task.

    RFID service only cares about HTTP status — verification results go to dashboard via WS.
    """
    tag = body.rfid_tag.strip()
    logger.info("RFID ingest received tag=%s", tag)

    manager = get_manager()
    session = get_session()
    session.reset()

    await manager.broadcast(event_message(EVENT_RFID_SCANNING))

    barricade_id = default_barricade_id()
    if not barricade_id:
        await manager.broadcast(
            event_message(
                EVENT_RFID_CHECK_RESULT,
                status="FAILED",
                rfid=body.rfid_tag.strip(),
                detail="API Agent: set DEFAULT_BARRICADE_ID env for backend verification",
            )
        )
        logger.warning("RFID ingest: DEFAULT_BARRICADE_ID not set; failing open for dashboard")
        return {"accepted": True, "note": "barricade_id not configured; emitted failure to dashboard"}

    try:
        UUID(barricade_id)
    except ValueError:
        raise HTTPException(status_code=500, detail="DEFAULT_BARRICADE_ID must be a valid UUID")

    url = f"{backend_base_url()}/api/verify/rfid"
    payload = {"rfid_tag": body.rfid_tag.strip(), "barricade_id": barricade_id}
    logger.debug("POST %s for RFID verify", url)

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.post(url, json=payload)
            r.raise_for_status()
            data = r.json()
    except httpx.HTTPStatusError as e:
        try:
            err_body = e.response.json()
            detail = err_body.get("detail", str(e))
        except Exception:
            detail = e.response.text or str(e)
        await manager.broadcast(
            event_message(
                EVENT_RFID_CHECK_RESULT,
                status="FAILED",
                rfid=body.rfid_tag.strip(),
                detail=f"Backend error: {detail}",
            )
        )
        logger.error("RFID ingest: backend HTTP error for tag=%s: %s", tag, detail)
        return {"accepted": True, "note": "backend returned error; failure pushed to dashboard"}
    except (httpx.RequestError, ValueError) as e:
        await manager.broadcast(
            event_message(
                EVENT_RFID_CHECK_RESULT,
                status="FAILED",
                rfid=body.rfid_tag.strip(),
                detail=f"Backend unreachable: {e!s}",
            )
        )
        logger.error("RFID ingest: backend unreachable for tag=%s: %s", tag, e)
        return {"accepted": True, "note": "backend unreachable; failure pushed to dashboard"}

    session.set_rfid_result(data)
    status = data.get("status", "?")
    logger.info("RFID backend result tag=%s status=%s", tag, status)
    ws_payload = _map_backend_to_ws_payload(data)
    await manager.broadcast(ws_payload)

    if data.get("status") == "VALIDATED":
        logger.info("RFID validated; scheduling ANPR pipeline")
        asyncio.create_task(run_anpr_pipeline())

    return {"accepted": True}
