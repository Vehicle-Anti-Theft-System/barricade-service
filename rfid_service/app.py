"""Mock RFID service — push-only to API Agent (no data pulled from the agent)."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.responses import HTMLResponse

from rfid_service.logging_config import configure_logging
from rfid_service.push import push_rfid_tag
from rfid_service.service import mock_rfid_queue

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    configure_logging()
    logger.info("RFID service (mock) starting on port 8002 — push-only to API Agent")
    yield
    logger.info("RFID service shutdown")


app = FastAPI(
    title="RFID Service (Mock)",
    version="0.2.0",
    description="Simulates tag reads; forwards only { rfid_tag } to the API Agent via HTTP POST.",
    lifespan=lifespan,
)

_UI_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>RFID Mock — Simulate scan</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 560px; margin: 2rem auto; padding: 0 1rem; }
    h1 { font-size: 1.25rem; }
    button { padding: 0.6rem 1.2rem; font-size: 1rem; cursor: pointer; }
    pre { background: #f4f4f4; padding: 1rem; overflow: auto; border-radius: 6px; font-size: 0.85rem; }
    .hint { color: #555; font-size: 0.9rem; margin-top: 1rem; }
    .ref { margin-top: 1.75rem; padding-top: 1.25rem; border-top: 1px solid #ddd; }
    .ref h2 { font-size: 1.05rem; margin: 0 0 0.5rem; }
    .ref p { font-size: 0.9rem; color: #444; margin: 0 0 0.75rem; }
    table.ref-table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
    table.ref-table th, table.ref-table td { border: 1px solid #ccc; padding: 0.45rem 0.6rem; text-align: left; }
    table.ref-table th { background: #f0f0f0; font-weight: 600; }
    table.ref-table tbody tr:nth-child(even) { background: #fafafa; }
    table.ref-table code { font-size: 0.88em; }
  </style>
</head>
<body>
  <h1>RFID mock — simulate hardware trigger</h1>
  <p>Press the button to read the next mock tag and <strong>POST it to the API Agent</strong> only.</p>
  <form method="post" action="/trigger">
    <button type="submit">Simulate RFID scan</button>
  </form>
  <section class="ref" aria-labelledby="seed-ref-heading">
    <h2 id="seed-ref-heading">Backend seed reference (<code>backend-service/seed.py</code>)</h2>
    <p>Seeded trucks: RFID tag paired with license plate. After a successful RFID step, ANPR / manual entry should match this plate for that tag.</p>
    <table class="ref-table">
      <thead>
        <tr><th>RFID tag</th><th>License plate</th></tr>
      </thead>
      <tbody>
        <tr><td><code>TRK-0042</code></td><td><code>MH04AB1234</code></td></tr>
        <tr><td><code>TRK-0078</code></td><td><code>JH01CD5678</code></td></tr>
        <tr><td><code>TRK-0101</code></td><td><code>MH12EF9012</code></td></tr>
      </tbody>
    </table>
  </section>
  <p class="hint">Flow is one-way: RFID service → API Agent (<code>POST /rfid/scan</code>). Results appear on the dashboard via WebSocket.</p>
  <p class="hint">API: <code>POST /trigger</code> — JSON shows transport result only.</p>
  <p class="hint">Open <a href="/docs">/docs</a> for Swagger.</p>
</body>
</html>
"""


@app.get("/")
def root():
    logger.debug("GET /")
    return {
        "service": "rfid-service",
        "mode": "mock",
        "flow": "unidirectional_push",
        "description": "Sends rfid_tag to API Agent only; does not consume agent payloads.",
        "routes": {
            "health": "/health",
            "ui": "/ui",
            "trigger": "POST /trigger — cycles mock tag, POSTs to API Agent ingest URL",
        },
    }


@app.get("/ui", response_class=HTMLResponse)
def mock_ui():
    """Simple HTML page with a button to simulate an RFID read (for local testing)."""
    logger.debug("GET /ui")
    return _UI_HTML


@app.get("/health")
def health():
    logger.debug("GET /health")
    return {"status": "ok", "service": "rfid-service", "mode": "mock", "flow": "push_only"}


@app.post("/trigger")
def trigger_scan():
    """
    Simulate Arduino / serial: take next mock tag and POST `{ "rfid_tag": "<tag>" }` to the API Agent.

    Response is local transport feedback only (HTTP status from the ingest call), not verification outcome.
    """
    tag = mock_rfid_queue.next_tag()
    logger.info("Trigger: cycling mock tag=%s → POST to API Agent ingest", tag)
    ok, body, status = push_rfid_tag(tag)
    logger.info(
        "Trigger: ingest http_ok=%s http_status=%s",
        ok,
        status,
    )
    if not ok:
        logger.warning("Trigger: ingest failed or non-success (snippet=%s)", (body or "")[:200])
    return {
        "rfid_tag": tag,
        "ingest": {
            "http_ok": ok,
            "http_status": status,
            "response_snippet": body,
        },
        "note": "Verification result is broadcast by API Agent to the dashboard over WebSocket, not returned here.",
    }
