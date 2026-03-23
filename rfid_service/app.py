"""Mock RFID service — push-only to API Agent (no data pulled from the agent)."""

from fastapi import FastAPI
from fastapi.responses import HTMLResponse

from rfid_service.push import push_rfid_tag
from rfid_service.service import mock_rfid_queue

app = FastAPI(
    title="RFID Service (Mock)",
    version="0.2.0",
    description="Simulates tag reads; forwards only { rfid_tag } to the API Agent via HTTP POST.",
)

_UI_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>RFID Mock — Simulate scan</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 520px; margin: 2rem auto; padding: 0 1rem; }
    h1 { font-size: 1.25rem; }
    button { padding: 0.6rem 1.2rem; font-size: 1rem; cursor: pointer; }
    pre { background: #f4f4f4; padding: 1rem; overflow: auto; border-radius: 6px; font-size: 0.85rem; }
    .hint { color: #555; font-size: 0.9rem; margin-top: 1rem; }
  </style>
</head>
<body>
  <h1>RFID mock — simulate hardware trigger</h1>
  <p>Press the button to read the next mock tag and <strong>POST it to the API Agent</strong> only.</p>
  <form method="post" action="/trigger">
    <button type="submit">Simulate RFID scan</button>
  </form>
  <p class="hint">Flow is one-way: RFID service → API Agent (<code>POST /rfid/scan</code>). Results appear on the dashboard via WebSocket.</p>
  <p class="hint">API: <code>POST /trigger</code> — JSON shows transport result only.</p>
  <p class="hint">Open <a href="/docs">/docs</a> for Swagger.</p>
</body>
</html>
"""


@app.get("/")
def root():
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
    return _UI_HTML


@app.get("/health")
def health():
    return {"status": "ok", "service": "rfid-service", "mode": "mock", "flow": "push_only"}


@app.post("/trigger")
def trigger_scan():
    """
    Simulate Arduino / serial: take next mock tag and POST `{ "rfid_tag": "<tag>" }` to the API Agent.

    Response is local transport feedback only (HTTP status from the ingest call), not verification outcome.
    """
    tag = mock_rfid_queue.next_tag()
    ok, body, status = push_rfid_tag(tag)
    return {
        "rfid_tag": tag,
        "ingest": {
            "http_ok": ok,
            "http_status": status,
            "response_snippet": body,
        },
        "note": "Verification result is broadcast by API Agent to the dashboard over WebSocket, not returned here.",
    }
