# Barricade Service — Mine Site Gate (Edge)

Local **edge stack** for the mine-site anti-theft system: **RFID + ANPR** verification at the gate, orchestrated by an **API Agent** and a **React dashboard**. The **central API and MongoDB** live in [`backend-service`](../backend-service/); this repo is what runs **on the gate PC**.

For full architecture and behavior, see [`CONTEXT.MD`](CONTEXT.MD).

---

## Prerequisites

- **Python** 3.12+ (see `.python-version` if present)
- **[uv](https://docs.astral.sh/uv/)** — `curl -LsSf https://astral.sh/uv/install.sh | sh` or `brew install uv`
- **Node.js + npm** — for the dashboard (skip with install flag below if you only need Python services)
- **CUDA-capable GPU** (optional) — faster ANPR; CPU works too

---

## Install (one-time)

Run from the **`barricade-service/`** directory (repository root for this service).

**Recommended — dedicated install script:**

```bash
./bin/setup
```

This runs `uv sync` for the workspace (`api_agent`, `rfid_service`, `anpr_service`, and ANPR/ML dependencies), copies `.env.example` → `.env` if `.env` is missing, and runs `npm install` in `dashboard_service/`. The first `uv sync` can take several minutes (PyTorch / EasyOCR / YOLO).

**Equivalent wrapper** (same script):

```bash
./bin.setup
```

**Options:**

```bash
./bin/setup --skip-dashboard   # Python only; no npm in dashboard_service/
./bin/setup --help             # Full usage
```

**Manual install** (if you prefer not to use the script):

```bash
uv sync
cd dashboard_service && npm install && cd ..
cp .env.example .env   # if you do not already have .env
```

---

## Configure

Edit **`.env`** after install (especially before a live integration):

| Variable | Purpose |
|----------|---------|
| `BACKEND_BASE_URL` | Central API base URL (**no trailing slash**), e.g. `https://api.example.com` or `http://localhost:8000` for local backend |
| `DEFAULT_BARRICADE_ID` | UUID of this gate in the remote DB (matches seeded barricade in backend dev) |
| `BACKEND_API_KEY` | Must match the backend **`API_KEY`** (sent as `X-API-Key`) |

See `.env.example` for optional URLs (ANPR host, API agent host for the dashboard, log level, etc.).

---

## Run the edge stack

**Recommended — dedicated run script:**

```bash
./run-barricade.sh
```

Starts four processes:

| Service | Port | Notes |
|---------|------|--------|
| **api_agent** | 8080 | HTTP + WebSocket `ws://localhost:8080/ws` |
| **anpr_service** | 8001 | `GET /health`, `GET /video_feed`, `POST /capture` |
| **rfid_service** | 8002 | Mock RFID; `GET /ui`, `POST /trigger` |
| **dashboard_service** | 5173 | Vite dev server |

Press **Ctrl+C** to stop all child processes.

**Optional environment variables:**

```bash
SKIP_ANPR=1 ./run-barricade.sh       # Skip ANPR (no camera / ML)
SKIP_DASHBOARD=1 ./run-barricade.sh  # Skip the Vite dashboard only
```

If `node_modules` is missing, `run-barricade.sh` runs `npm install` in `dashboard_service/` before starting the dashboard.

**Central backend:** this script does **not** start `backend-service`. Deploy the backend separately (e.g. AWS) or run it locally from `backend-service/` with `./run-backend.sh`, then set `BACKEND_BASE_URL=http://localhost:8000` here.

---

## Overview of components

- **ANPR Service** — YOLOv8 + EasyOCR + SORT; plate read and MJPEG preview. Details: [anpr_service/README.md](anpr_service/README.md).
- **API Agent** — FastAPI + WebSocket; RFID ingest, calls to backend verify endpoints, ANPR pipeline. Details: [api_agent/README.md](api_agent/README.md).
- **RFID Service** — Mock reader; pushes `{ "rfid_tag" }` to the API Agent. Details: [rfid_service/README.md](rfid_service/README.md).
- **Dashboard** — Vite + React + Material UI v5. Details: [dashboard_service/README.md](dashboard_service/README.md).

---

## Optional: standalone ANPR demo

Root **`main.py`** can process a static image (demo only; not part of the four-service runtime):

```bash
uv run python main.py
```

---

## Project structure

```
barricade-service/
├── bin/setup           # Install: uv sync + .env bootstrap + npm (dashboard)
├── bin.setup           # Wrapper → bin/setup
├── run-barricade.sh    # Run: api_agent, anpr_service, rfid_service, dashboard
├── api_agent/
├── anpr_service/
├── rfid_service/
├── dashboard_service/
├── pyproject.toml      # uv workspace
├── .env.example
├── CONTEXT.MD
└── README.md
```

---

## Dependencies

See `pyproject.toml`. Notable stack: **Ultralytics YOLOv8**, **EasyOCR**, **OpenCV**, **FastAPI**, **httpx**; dashboard uses **React** and **@mui/material** v5.

---

## Acknowledgments

- [Ultralytics YOLOv8](https://github.com/ultralytics/ultralytics)
- [SORT](https://github.com/abewley/sort)
- [EasyOCR](https://github.com/JaidedAI/EasyOCR)
