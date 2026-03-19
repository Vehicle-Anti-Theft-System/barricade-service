# API Agent — Context

> Use this file to restore full context for the API Agent in any future conversation. (Updated 2026-03-18.)

## Role

The **API Agent** is the local orchestrator at each barricade. It:

- Accepts WebSocket connections from the **React Dashboard** (one or more clients per barricade).
- Receives inputs from (future) **RFID**, **ANPR**, and **Fingerprint** services.
- Sends verification events to the dashboard so the UI stays in sync (RFID → ANPR → Fingerprint → gate).
- (Future) Calls the **central backend** to validate RFID, plate, and fingerprint against registered orders.

Until RFID/ANPR/Fingerprint and the backend exist, the Agent runs a **mock verification flow** and responds to dashboard commands (simulate, session_reset, manual_plate, open_gate).

---

## Implementation Status

### ✅ Done

| Item | Notes |
|------|--------|
| **FastAPI app** | `app.py` with lifespan; clears connections on shutdown. |
| **Routes** | `GET /`, `GET /health`, `WebSocket /ws` (see `routes/`). |
| **Folder structure** | `core/` (events, connection), `routes/`, `services/`. |
| **WebSocket protocol** | Outbound events and inbound commands match dashboard reducer. |
| **Connection manager** | Single manager; broadcast for `session_reset`. |
| **Mock verification** | `services/verification.py`: RFID → ANPR → Fingerprint → gate_decision. |
| **Commands handled** | `simulate` / `start_verification`, `session_reset`, `manual_plate`, `open_gate`. |
| **Employee ID in commands** | Dashboard sends `employee_id` with simulate/start_verification; agent accepts and passes to `run_mock_verification(..., employee_id=...)` for when backend is wired (backend stores it on alerts). |

### ❌ Not done

| Item | Notes |
|------|--------|
| **RFID integration** | Poll RFID service; on tag read → send `rfid_check_result` (or call backend). |
| **ANPR integration** | Trigger snapshot from ANPR HTTP server; send `anpr_result` / `anpr_retry` / `anpr_manual`. |
| **Fingerprint integration** | On scan from Fingerprint service → send `fingerprint_result`. |
| **Backend integration** | HTTP client to Verification/Data service; replace mock with real validation. |
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
│   ├── __init__.py     # Single router aggregating root, health, ws
│   ├── root.py         # GET /
│   ├── health.py       # GET /health
│   └── ws.py           # WebSocket /ws — command dispatch + mock flow
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
| GET           | `/`      | Service info and links (docs, health, ws URL). |
| GET           | `/health`| Health check; returns `{ "status": "ok", "service": "api-agent" }`. |
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
| `rfid_check_result`  | Backend/mock result: `status`, `rfid`, `truck_id`, `order_id` or `detail`. |
| `anpr_processing`    | ANPR capture started. |
| `anpr_result`        | Plate result: `status`, `plate`, `confidence` or `detail`. |
| `anpr_retry`         | Low confidence retry: `attempt`. |
| `anpr_manual`        | 3x failure; manual entry required. |
| `fingerprint_scanning`| Fingerprint read started. |
| `fingerprint_result` | Driver result: `status`, `driver`, `driver_id`, `fingerprint_id`, `all_clear` or `detail`. |
| `gate_decision`      | `open`, `method` (e.g. `"auto"`, `"manual"`). |
| `alert_raised`       | `type`, `detail`; optional `employee_id` when backend is wired. |

### Inbound (Dashboard → API Agent)

Dashboard sends JSON with `event` or `command`.

| event / command      | Payload | Agent behavior |
|----------------------|---------|----------------|
| `simulate` / `start_verification` | optional `auto_open` (default true), optional `employee_id` (logged-in barricade employee) | Run mock flow; pass `employee_id` to verification (for backend when wired); send event sequence; optionally send `gate_decision`. |
| `session_reset`      | —       | Broadcast `session_reset` to all clients. |
| `manual_plate`       | `plate` | Send `anpr_result` (VALIDATED, that plate) then `fingerprint_scanning`. |
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
- **uvicorn** — ASGI server.

See `api_agent/pyproject.toml`. Workspace root lists `api-agent` so `uv run` from root installs and runs the agent.

---

## Related

- **Repo root `CONTEXT.MD`** — Full system (problem, 3-factor flow, dashboard state machine, WebSocket events).
- **Dashboard** — `dashboard_service/`; `useWebSocket`, `useVerificationState` consume these events.
