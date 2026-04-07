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

_UI_HTML = """\
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>RFID Mock — Simulate scan</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    :root {
      --bg: #f8f9fa; --surface: #fff; --border: #e0e0e0;
      --text: #1a1a1a; --text2: #555; --accent: #1976d2;
      --accent-hover: #1565c0; --success: #2e7d32; --error: #c62828;
      --radius: 10px; --shadow: 0 1px 3px rgba(0,0,0,.08);
    }
    body { font-family: system-ui, -apple-system, sans-serif; margin: 0; background: var(--bg); color: var(--text); }
    .shell { max-width: 640px; margin: 0 auto; padding: 2rem 1.25rem 3rem; }
    header { display: flex; align-items: center; gap: .75rem; margin-bottom: 1.5rem; }
    header .dot { width: 10px; height: 10px; border-radius: 50%; background: var(--accent); flex-shrink: 0; }
    header h1 { font-size: 1.15rem; font-weight: 700; margin: 0; }
    header .sub { font-size: .82rem; color: var(--text2); margin: 0; }
    .card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow); padding: 1.5rem; margin-bottom: 1.25rem; }
    .card h2 { font-size: .95rem; font-weight: 700; margin: 0 0 .75rem; }
    .scan-row { display: flex; gap: .75rem; align-items: center; flex-wrap: wrap; }
    #scanBtn {
      padding: .65rem 1.6rem; font-size: .95rem; font-weight: 600; border: none; border-radius: 8px;
      background: var(--accent); color: #fff; cursor: pointer; transition: background .15s, transform .1s;
    }
    #scanBtn:hover:not(:disabled) { background: var(--accent-hover); }
    #scanBtn:active:not(:disabled) { transform: scale(.97); }
    #scanBtn:disabled { opacity: .55; cursor: not-allowed; }
    #status {
      font-size: .88rem; font-weight: 600; padding: .35rem .8rem; border-radius: 6px;
      display: none; line-height: 1.3;
    }
    #status.ok { display: inline-block; background: #e8f5e9; color: var(--success); }
    #status.err { display: inline-block; background: #ffebee; color: var(--error); }
    #status.busy { display: inline-block; background: #e3f2fd; color: var(--accent); }
    .log { margin-top: 1rem; max-height: 220px; overflow-y: auto; }
    .log table { width: 100%; border-collapse: collapse; font-size: .82rem; }
    .log th, .log td { padding: .4rem .6rem; text-align: left; border-bottom: 1px solid var(--border); }
    .log th { font-weight: 600; position: sticky; top: 0; background: var(--surface); }
    .log .tag { font-family: ui-monospace, monospace; }
    .log .ok { color: var(--success); font-weight: 600; }
    .log .fail { color: var(--error); font-weight: 600; }
    .ref table { width: 100%; border-collapse: collapse; font-size: .85rem; }
    .ref th, .ref td { padding: .45rem .65rem; text-align: left; border-bottom: 1px solid var(--border); }
    .ref th { font-weight: 600; color: var(--text2); }
    .ref code { font-size: .88em; background: #f0f0f0; padding: 0 .3em; border-radius: 3px; }
    .hint { font-size: .82rem; color: var(--text2); margin-top: .75rem; line-height: 1.45; }
    .hint a { color: var(--accent); }
    .empty { text-align: center; color: var(--text2); padding: 1rem 0; font-size: .85rem; }
  </style>
</head>
<body>
<div class="shell">
  <header>
    <span class="dot"></span>
    <div>
      <h1>RFID Mock Service</h1>
      <p class="sub">Simulate hardware scans — push to API Agent</p>
    </div>
  </header>

  <div class="card">
    <h2>Trigger scan</h2>
    <div class="scan-row">
      <button id="scanBtn" type="button">Scan next tag</button>
      <span id="status"></span>
    </div>
    <div class="log">
      <table>
        <thead><tr><th>#</th><th>Tag</th><th>HTTP</th><th>Result</th></tr></thead>
        <tbody id="logBody">
          <tr><td colspan="4" class="empty">No scans yet</td></tr>
        </tbody>
      </table>
    </div>
  </div>

  <div class="card ref">
    <h2>Seed reference</h2>
    <p class="hint" style="margin-top:0">Tags below match <code>backend-service/seed.py</code>.
    After RFID validates, ANPR / manual plate must match the paired license plate.</p>
    <table>
      <thead><tr><th>RFID tag</th><th>License plate</th></tr></thead>
      <tbody>
        <tr><td><code>TRK-0042</code></td><td><code>MH04AB1234</code></td></tr>
        <tr><td><code>TRK-0078</code></td><td><code>JH01CD5678</code></td></tr>
        <tr><td><code>TRK-0101</code></td><td><code>MH12EF9012</code></td></tr>
      </tbody>
    </table>
  </div>

  <p class="hint">One-way flow: RFID service &rarr; API Agent <code>POST /rfid/scan</code>.
  Verification results appear on the dashboard via WebSocket.</p>
  <p class="hint"><a href="/docs">Swagger docs</a> &middot; <a href="/health">Health check</a></p>
</div>

<script>
(function(){
  const btn = document.getElementById("scanBtn");
  const statusEl = document.getElementById("status");
  const logBody = document.getElementById("logBody");
  let count = 0;
  let firstScan = true;

  function setStatus(cls, text) {
    statusEl.className = cls;
    statusEl.textContent = text;
    statusEl.style.display = "inline-block";
  }

  btn.addEventListener("click", async () => {
    btn.disabled = true;
    setStatus("busy", "Scanning…");
    try {
      const res = await fetch("/trigger", { method: "POST" });
      const data = await res.json();
      const tag = data.rfid_tag || "?";
      const ok = data.ingest?.http_ok;
      const httpStatus = data.ingest?.http_status ?? "—";
      count++;

      if (firstScan) { logBody.innerHTML = ""; firstScan = false; }

      const tr = document.createElement("tr");
      tr.innerHTML =
        "<td>" + count + "</td>" +
        '<td class="tag">' + tag + "</td>" +
        "<td>" + httpStatus + "</td>" +
        '<td class="' + (ok ? "ok" : "fail") + '">' + (ok ? "Sent" : "Failed") + "</td>";
      logBody.prepend(tr);

      setStatus(ok ? "ok" : "err", ok ? "Tag " + tag + " sent" : "Send failed — " + httpStatus);
    } catch (e) {
      setStatus("err", "Network error");
    } finally {
      btn.disabled = false;
    }
  });
})();
</script>
</body>
</html>
"""


@app.get("/favicon.ico", include_in_schema=False)
def favicon():
    from starlette.responses import Response
    return Response(status_code=204)


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
