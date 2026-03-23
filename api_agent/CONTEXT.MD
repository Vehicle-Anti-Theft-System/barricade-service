# API Agent — Context

> Use this file to restore full context for the API Agent in any future conversation.

## Role

The **API Agent** is the local orchestrator at each barricade. It:

- Accepts WebSocket connections from the **React Dashboard** (one or more clients per barricade).
- Receives inputs from (future) **RFID** and **ANPR** services (2-factor verification: RFID + license plate).
- Sends verification events to the dashboard so the UI stays in sync (**RFID → ANPR → gate**).
- Calls the **central backend** where configured (e.g. RFID ingest → `POST /api/verify/rfid`).

Until ANPR is fully wired, the Agent can run a **mock verification flow** and responds to dashboard commands (`simulate`, `session_reset`, `manual_plate`, `open_gate`).

---

## Implementation Status

### ✅ Done

| Item | Notes |
|------|--------|
| **FastAPI app** | `app.py` with lifespan; clears connections on shutdown. |
| **Routes** | `GET /`, `GET /health`, `POST /rfid/scan` (RFID service ingest), `WebSocket /ws` (see `routes/`). |
| **Folder structure** | `core/` (events, connection), `routes/`, `services/`. |
| **WebSocket protocol** | Outbound events and inbound commands match dashboard reducer. |
| **Connection manager** | Single manager; broadcast for `session_reset`. |
| **Mock verification** | `services/verification.py`: RFID → ANPR → `gate_decision` (no fingerprint step). |
| **Commands handled** | `simulate` / `start_verification`, `session_reset`, `manual_plate`, `open_gate`. |
| **Employee ID in commands** | Dashboard sends `employee_id` with simulate/start_verification; reserved for backend alerts. |
| **RFID ingest** | `POST /rfid/scan` — body `{ rfid_tag }` from RFID service only; calls backend `POST /api/verify/rfid` when `DEFAULT_BARRICADE_ID` + `BACKEND_BASE_URL` set; broadcasts `rfid_scanning` + `rfid_check_result`. |

### ❌ Not done

| Item | Notes |
|------|--------|
| **RFID hardware** | Replace mock tag queue with serial/SDK; keep posting same JSON to `/rfid/scan`. |
| **ANPR integration** | Trigger snapshot from ANPR HTTP server; send `anpr_result` / `anpr_retry` / `anpr_manual`. |
| **Backend integration (ANPR + gate)** | Wire ANPR verify + `gate-open` to backend from live flow. |
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
│   ├── __init__.py     # Single router aggregating root, health, rfid, ws
│   ├── root.py         # GET /
│   ├── health.py       # GET /health
│   ├── rfid_scan.py    # POST /rfid/scan — ingest from RFID service
│   └── ws.py           # WebSocket /ws — command dispatch + mock flow
├── config.py           # BACKEND_BASE_URL, DEFAULT_BARRICADE_ID
├── services/
│   ├── __init__.py
│   └── verification.py # event_message(), run_mock_verification()
├── pyproject.toml
├── README.md
└── CONTEXT.MD          # This file
```

---

## Routes

| Method / Type | Path     | Description |
|---------------|----------|-------------|
| GET           | `/`      | Service info and links (docs, health, ws URL, RFID ingest hint). |
| GET           | `/health`| Health check; returns `{ "status": "ok", "service": "api-agent" }`. |
| POST          | `/rfid/scan` | Ingest `{ "rfid_tag": "..." }` from local RFID service (one-way); agent validates via backend + broadcasts WS. |
| WebSocket     | `/ws`    | Verification events and commands (see below). |

Default port: **8080**. Dashboard connects to `ws://localhost:8080/ws`.

---

## WebSocket protocol

Contract is defined in repo root `CONTEXT.MD` and implemented in `dashboard_service/src/hooks/useVerificationState.js`. Event and command names live in `core/events.py`.

### Outbound (API Agent → Dashboard)

Every message is JSON with an `event` field. Dashboard dispatches `{ type: msg.event, payload: msg }`.

| event                | When / purpose |
|----------------------|----------------|
| `session_reset`      | On connect; when client sends `session_reset` (broadcast). |
| `rfid_scanning`      | RFID read started. |
| `rfid_check_result`  | Backend/mock result: `status`, `rfid`, `truck_id`, `order_id`, optional `driver_name`, or `detail`. |
| `anpr_processing`    | ANPR capture started. |
| `anpr_result`        | Plate result: `status`, `plate`, `confidence` or `detail`. |
| `anpr_retry`         | Low confidence retry: `attempt`. |
| `anpr_manual`        | 3x failure; manual entry required. |
| `gate_decision`      | `open`, `method` (e.g. `"auto"`, `"manual"`). |
| `alert_raised`       | `type`, `detail`; optional `employee_id` when backend is wired. |

### Inbound (Dashboard → API Agent)

Dashboard sends JSON with `event` or `command`.

| event / command      | Payload | Agent behavior |
|----------------------|---------|----------------|
| `simulate` / `start_verification` | optional `auto_open` (default true), optional `employee_id` | Run mock RFID → ANPR → gate flow; optionally send `gate_decision`. |
| `session_reset`      | —       | Broadcast `session_reset` to all clients. |
| `manual_plate`       | `plate` | Send `anpr_result` (VALIDATED, that plate). |
| `open_gate`          | —       | Send `gate_decision` (open, method=manual). |

---

## Run

From repo root (with workspace synced):

```bash
uv run uvicorn api_agent.app:app --host 0.0.0.0 --port 8080
```

Or:

```bash
uv run api-agent
```

---

## Dependencies

- **FastAPI** — HTTP and WebSocket.
- **httpx** — Async HTTP to central backend (RFID ingest path).
- **uvicorn** — ASGI server.

See `api_agent/pyproject.toml`. Workspace root lists `api-agent` so `uv run` from root installs and runs the agent.

---

## Related

- **Repo root `CONTEXT.MD`** — Full system (problem, 2-factor flow, dashboard state machine, WebSocket events).
- **Dashboard** — `dashboard_service/`; `useWebSocket`, `useVerificationState` consume these events.
