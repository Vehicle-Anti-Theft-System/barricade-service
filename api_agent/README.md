# Barricade API Agent

FastAPI + WebSocket orchestrator for barricade verification (**RFID → ANPR → gate**). Events follow the dashboard contract in CONTEXT.MD.

## Run

From repo root:

```bash
uv run uvicorn api_agent.app:app --host 0.0.0.0 --port 8080
```

Or with the console script (after `uv sync`):

```bash
uv run api-agent
```

## Routes

| Method / Type | Path     | Description                |
|---------------|----------|----------------------------|
| GET           | `/`      | Service info and links     |
| GET           | `/health`| Health check               |
| WebSocket     | `/ws`    | Verification events/commands |

## Folder structure

```
api_agent/
├── __init__.py
├── main.py           # Entry point (uvicorn)
├── app.py            # FastAPI app, lifespan, router
├── core/             # Shared primitives
│   ├── __init__.py
│   ├── events.py     # Event/command name constants
│   └── connection.py # WebSocket ConnectionManager
├── routes/           # HTTP and WebSocket endpoints
│   ├── __init__.py   # Aggregates routers
│   ├── root.py       # GET /
│   ├── health.py     # GET /health
│   ├── rfid_scan.py  # POST /rfid/scan (RFID service ingest)
│   └── ws.py         # WebSocket /ws
├── services/         # Business logic
│   ├── __init__.py
│   ├── backend_client.py  # Backend HTTP: retries, X-API-Key, timeouts
│   ├── session.py    # Verification session (RFID context for manual / gate)
│   └── verification.py  # Mock + live ANPR pipelines
├── config.py         # Env + log_effective_settings()
├── logging_config.py # LOG_LEVEL, format
├── pyproject.toml
└── README.md
```

## Logging

| Env | Default | Purpose |
|-----|---------|---------|
| `LOG_LEVEL` | `INFO` | `DEBUG` shows HTTP/WS details, broadcast fan-out, ANPR/backend payloads |
| `BACKEND_API_KEY` | — | Must match backend `API_KEY` when the server enforces auth |
| `BACKEND_MAX_RETRIES` | `4` | Retries for 502/503/504 and connection errors |
| `BACKEND_HTTP_TIMEOUT_SEC` | `25` | Per-request timeout to the cloud API |

On startup the agent logs effective settings (`BACKEND_BASE_URL`, `BACKEND_API_KEY` set or not, `ANPR_SERVICE_URL`, `DEFAULT_BARRICADE_ID`, retry counts). WebSocket commands, RFID ingest, and backend HTTP calls are logged at INFO; use `DEBUG` for full request/response traces.

## WebSocket commands (dashboard → agent)

- `{ "event": "simulate" }` or `{ "command": "start_verification" }` — run mock verification flow
- `{ "event": "session_reset" }` — reset session (broadcast to all clients)
- `{ "event": "manual_plate", "plate": "MH12AB4821" }` — accept manual plate (`anpr_result` VALIDATED)
- `{ "event": "open_gate" }` — send gate_decision (open, method=manual)

Events sent to the dashboard match the reducer in `dashboard_service/src/hooks/useVerificationState.js`.
