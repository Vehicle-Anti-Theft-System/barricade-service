# API Agent — Context

> Use this file to restore full context for the API Agent in any future conversation.  
> **Last updated:** 2026-03-24

## Role

The **API Agent** is the local orchestrator at each barricade. It:

- Accepts WebSocket connections from the **React Dashboard** (one or more clients per barricade).
- Ingests **RFID** via `POST /rfid/scan` and runs the **live ANPR pipeline** (HTTP to local ANPR `/capture`, then backend `/api/verify/anpr`, optional `/api/verify/gate-open`).
- Sends verification events to the dashboard so the UI stays in sync (**RFID → ANPR → gate**).
- Calls the **central backend** when `BACKEND_BASE_URL`, `BACKEND_API_KEY`, and `DEFAULT_BARRICADE_ID` are set.

**Mock flow:** `simulate` / `start_verification` runs timed RFID → ANPR → optional `gate_decision` (optional `auto_open`). When the backend is configured, the mock RFID step can hydrate session via `POST /api/verify/rfid` for a fixed tag.

---

## Implementation Status

### ✅ Done

| Item | Notes |
|------|--------|
| **FastAPI app** | `app.py` with lifespan; clears connections on shutdown. |
| **Routes** | `GET /`, `GET /health`, `POST /rfid/scan` (RFID service ingest), `WebSocket /ws` (see `routes/`). |
| **Folder structure** | `core/` (events, connection), `routes/`, `services/`. |
| **WebSocket protocol** | Outbound events and inbound commands match `dashboard_service` reducer (`core/events.py`). |
| **Connection manager** | `ConnectionManager`; broadcast for `session_reset`; `send_to` for directed messages. |
| **Mock verification** | `services/verification.py` — `run_mock_verification()`: RFID → ANPR → optional gate (respects `auto_open`). |
| **Live ANPR pipeline** | `run_anpr_pipeline()` after successful RFID ingest: `/capture` retries, `anpr_manual`, backend ANPR verify; **gate** only if `session.auto_open_after_verify`. |
| **Manual plate** | `verify_manual_plate()` — backend ANPR verify; **backend gate-open + `gate_decision`** only if `session.auto_open_after_verify` (submitting plate is not the same as **Open Barricade**). |
| **Open gate button** | `open_gate_live()` — user-initiated; always attempts backend + `gate_decision` (`method=manual`) when session allows. |
| **Session** | `services/session.py` — `VerificationSession`: RFID/order/plate context + **`auto_open_after_verify`** (default `True`; **not** cleared in `reset()` so it behaves like a user preference across verification resets). |
| **Commands handled** | `simulate` / `start_verification`, **`set_auto_open`**, `session_reset`, `manual_plate`, `open_gate`. |
| **RFID ingest** | `POST /rfid/scan` — `{ rfid_tag }`; backend `POST /api/verify/rfid`; broadcasts `rfid_scanning` + `rfid_check_result`. |

### ❌ Not done / future

| Item | Notes |
|------|--------|
| **RFID hardware** | Replace mock tag queue with serial/SDK; keep posting same JSON to `/rfid/scan`. |
| **Auth** | No auth on WebSocket or HTTP; add if needed for production. |

---

## Folder structure

```
api_agent/
├── __init__.py
├── app.py              # FastAPI app, lifespan, include_router(router)
├── main.py             # Entry point: uvicorn run
├── core/
│   ├── __init__.py
│   ├── events.py       # EVENT_* and CMD_* constants (contract with dashboard)
│   └── connection.py   # ConnectionManager, get_manager()
├── routes/
│   ├── __init__.py     # Router: root, health, rfid, ws
│   ├── root.py
│   ├── health.py
│   ├── rfid_scan.py    # POST /rfid/scan
│   └── ws.py           # WebSocket /ws — command dispatch, simulate, session flags
├── config.py           # BACKEND_BASE_URL, BACKEND_API_KEY, DEFAULT_BARRICADE_ID, ANPR URLs, retries
├── logging_config.py
├── services/
│   ├── __init__.py
│   ├── session.py      # VerificationSession (includes auto_open_after_verify)
│   ├── backend_client.py
│   └── verification.py # mock + live ANPR + manual plate + open_gate_live
├── pyproject.toml
├── README.md
└── CONTEXT.MD          # This file
```

---

## Routes

| Method / Type | Path     | Description |
|---------------|----------|-------------|
| GET           | `/`      | Service info and links (docs, health, ws URL, RFID ingest hint). |
| GET           | `/health`| Health check. |
| POST          | `/rfid/scan` | Ingest `{ "rfid_tag": "..." }` from local RFID service; backend verify + WS broadcast. |
| WebSocket     | `/ws`    | Verification events and commands. |

Default port: **8080**. Dashboard connects to `ws://<host>:8080/ws` (see `VITE_API_AGENT_HOST`).

---

## WebSocket protocol

Contract aligns with `dashboard_service/src/hooks/useVerificationState.js`. Names in `core/events.py`.

### Outbound (API Agent → Dashboard)

JSON with an `event` field. Dashboard dispatches `{ type: msg.event, payload: msg }`.

| event                | When / purpose |
|----------------------|----------------|
| `session_reset`      | On connect; when client sends `session_reset` (broadcast). |
| `rfid_scanning`      | RFID read started. |
| `rfid_check_result`  | Backend/mock result: `status`, `rfid`, `truck_id`, `order_id`, optional `driver_name`, `expected_plate`, or failure `detail` / `alert_type`. |
| `anpr_processing`    | ANPR capture started. |
| `anpr_result`        | Plate result: `status`, `plate`, `confidence` or mismatch fields. |
| `anpr_retry`         | Retry: `attempt`. |
| `anpr_manual`        | Max capture failures; manual entry required. |
| `gate_decision`      | `open`, `method` (`"auto"` \| `"manual"`). |
| `alert_raised`       | When used. |

### Inbound (Dashboard → API Agent)

JSON with `event` or `command`.

| event / command      | Payload | Agent behavior |
|----------------------|---------|----------------|
| `simulate` / `start_verification` | optional **`auto_open`** (default true), optional `employee_id` | Run mock flow; set `session.auto_open_after_verify`; optionally send `gate_decision`. |
| **`set_auto_open`** | **`auto_open`** bool | Set `session.auto_open_after_verify` (must track dashboard **Open Automatically**). |
| `session_reset`      | —       | `session.reset()` (keeps `auto_open_after_verify`); broadcast `session_reset`. |
| `manual_plate`       | `plate` | Backend ANPR verify; on success, gate **only if** `auto_open_after_verify`. |
| `open_gate`          | —       | User **Open Barricade**; backend + `gate_decision` (`manual`). |

---

## Gate policy (`auto_open_after_verify`)

- Set from **`simulate`** / **`start_verification`** (`auto_open` in JSON) and from **`set_auto_open`** (dashboard toggle).
- **Live ANPR success:** backend `gate-open` + WS `gate_decision` (auto) **only if** this flag is true.
- **Manual plate success:** same — no automatic gate when false; operator uses **`open_gate`**.
- **Explicit `open_gate`:** always runs physical/backend open path when session is valid (independent of the flag).

---

## Run

```bash
uv run uvicorn api_agent.app:app --host 0.0.0.0 --port 8080
# or: uv run api-agent
```

---

## Dependencies

- **FastAPI** — HTTP and WebSocket.
- **httpx** — Async HTTP to central backend and ANPR service.
- **uvicorn** — ASGI server.

See `api_agent/pyproject.toml`.

---

## Related

- **`../CONTEXT.MD`** — Full barricade edge system.
- **`../../backend-service/CONTEXT.MD`** — Central API + MongoDB.
- **Dashboard** — `dashboard_service/`; reducer includes `autoOpenEnabled` and `set_auto_open` dispatch + WS sync.
