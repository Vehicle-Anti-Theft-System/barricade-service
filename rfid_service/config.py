"""RFID service settings — push-only to API Agent (no inbound data from agent)."""
import os


def api_agent_ingest_url() -> str:
    """POST target: API Agent `POST /rfid/scan` (full URL)."""
    return os.getenv(
        "API_AGENT_RFID_INGEST_URL",
        "http://localhost:8080/rfid/scan",
    ).rstrip("/")
