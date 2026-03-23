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
│   └── ws.py         # WebSocket /ws
├── services/         # Business logic
│   ├── __init__.py
│   └── verification.py  # Mock RFID→ANPR→gate flow
├── pyproject.toml
└── README.md
```

## WebSocket commands (dashboard → agent)

- `{ "event": "simulate" }` or `{ "command": "start_verification" }` — run mock verification flow
- `{ "event": "session_reset" }` — reset session (broadcast to all clients)
- `{ "event": "manual_plate", "plate": "MH12AB4821" }` — accept manual plate (`anpr_result` VALIDATED)
- `{ "event": "open_gate" }` — send gate_decision (open, method=manual)

Events sent to the dashboard match the reducer in `dashboard_service/src/hooks/useVerificationState.js`.
