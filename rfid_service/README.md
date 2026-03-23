# RFID Service (Mock)

Mock RFID layer for local barricade development. **Flow is unidirectional:** this service **only sends** `{ "rfid_tag": "<string>" }` to the **API Agent** (`POST /rfid/scan`). It does **not** fetch configuration or verification data from the agent. Guards see outcomes on the **dashboard** (WebSocket from the API Agent).

## Why this exists

- Test API Agent ingest without hardware.
- Later: replace mock queue + button with serial/SDK; keep the same `push_rfid_tag` call.

## Configuration

| Env | Default | Purpose |
|-----|---------|---------|
| `API_AGENT_RFID_INGEST_URL` | `http://localhost:8080/rfid/scan` | Full URL for `POST` body `{ "rfid_tag": "..." }` |
| `LOG_LEVEL` | `INFO` | Python logging: `DEBUG`, `INFO`, `WARNING`, `ERROR` |

Barricade identity for backend verification is configured on the **API Agent** (`DEFAULT_BARRICADE_ID`), not sent by the RFID service.

## Run

From `barricade-service/`:

```bash
uv sync
uv run uvicorn rfid_service.app:app --host 0.0.0.0 --port 8002
```

or:

```bash
uv run rfid-service
```

Ensure the **API Agent** is listening on port **8080** (or point `API_AGENT_RFID_INGEST_URL` at it).

## Endpoints

- `GET /health` — service health
- `GET /ui` — HTML page with **Simulate RFID scan** (POSTs to `/trigger`)
- `POST /trigger` — cycles a mock tag string, **POSTs only `rfid_tag` to the API Agent**, returns HTTP transport result (not business verification)

There are no `/scan/next`, `/peek`, or list endpoints — the RFID layer does not expose a pull API for the agent.

## Mock tags

Edit `mock_data.py` (`MOCK_RFID_TAGS`) to change cycled tag strings.
