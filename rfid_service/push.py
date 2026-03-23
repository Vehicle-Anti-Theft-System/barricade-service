"""Push RFID tag to API Agent (unidirectional: RFID → API Agent only)."""

import logging

import httpx

from rfid_service.config import api_agent_ingest_url

logger = logging.getLogger(__name__)


def push_rfid_tag(rfid_tag: str) -> tuple[bool, str | None, int | None]:
    """
    POST only { rfid_tag } to API Agent.

    Returns (http_ok, response_body_snippet_or_error, http_status).
    The RFID service does not interpret business logic from the response — only transport status.
    """
    url = api_agent_ingest_url()
    tag = rfid_tag.strip()
    logger.debug("POST %s with rfid_tag=%s", url, tag)
    try:
        with httpx.Client(timeout=15.0) as client:
            r = client.post(url, json={"rfid_tag": tag})
            text = r.text[:500] if r.text else ""
            ok = r.is_success
            status = r.status_code
            if ok:
                logger.info("Ingest OK status=%s for tag=%s", status, tag)
            else:
                logger.warning(
                    "Ingest non-success status=%s for tag=%s body_snippet=%s",
                    status,
                    tag,
                    text[:200] if text else "",
                )
            return ok, text or None, status
    except httpx.RequestError as e:
        logger.error("Ingest request failed for tag=%s: %s", tag, e)
        return False, str(e), None
