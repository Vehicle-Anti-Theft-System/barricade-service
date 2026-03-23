"""Push RFID tag to API Agent (unidirectional: RFID → API Agent only)."""

import httpx

from rfid_service.config import api_agent_ingest_url


def push_rfid_tag(rfid_tag: str) -> tuple[bool, str | None, int | None]:
    """
    POST only { rfid_tag } to API Agent.

    Returns (http_ok, response_body_snippet_or_error, http_status).
    The RFID service does not interpret business logic from the response — only transport status.
    """
    url = api_agent_ingest_url()
    try:
        with httpx.Client(timeout=15.0) as client:
            r = client.post(url, json={"rfid_tag": rfid_tag.strip()})
            text = r.text[:500] if r.text else ""
            return r.is_success, text or None, r.status_code
    except httpx.RequestError as e:
        return False, str(e), None
