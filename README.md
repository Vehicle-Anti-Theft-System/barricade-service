# Barricade Service — Mine Site Gate (Edge)

Local **edge stack** for the mine-site anti-theft system: **RFID + ANPR** verification at the gate, orchestrated by an **API Agent** and a **React dashboard**. The **central API and MongoDB** live in **[`backend-service`](../backend-service/)**; this folder is what runs **on the gate PC**.

| Doc | Use |
|-----|-----|
| [`CONTEXT.MD`](CONTEXT.MD) | Edge architecture, ports, WebSocket events, roadmap |
| [`dashboard_service/CONTEXT.MD`](dashboard_service/CONTEXT.MD) | Dashboard: JWT, admin routes, hooks |
| [`../backend-service/project_context.md`](../backend-service/project_context.md) | **Whole project** (edge + central API) |

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

Edit **`.env`** after install (especially before live integration with the central API):

| Variable | Purpose |
|----------|---------|
| **`BACKEND_BASE_URL`** | Central API base URL (**no trailing slash**), e.g. `https://api.example.com` or `http://localhost:8000` |
| **`BACKEND_API_KEY`** | Must **exactly** match backend **`API_KEY`** (sent as `X-API-Key` on verify calls) |
| **`DEFAULT_BARRICADE_ID`** | UUID of this gate in MongoDB (matches seeded barricade in backend dev: `ba11ad01-dead-4ead-beef-feedbadc0de1`) |
| **`VITE_API_AGENT_HOST`** | Host:port for dashboard WebSocket, e.g. `localhost:8080` |
| **`VITE_ANPR_HOST`** | Host:port for MJPEG camera preview, e.g. `localhost:8001` |
| **`VITE_BACKEND_URL`** | Same logical origin as **`BACKEND_BASE_URL`** — enables **JWT login** and **`/admin`** (orders, trucks, drivers, alerts). **Unset** → offline demo login (see `.env.example`) |

Optional: `ANPR_SERVICE_URL`, `API_AGENT_RFID_INGEST_URL`, retry/timeouts, `LOG_LEVEL`. See **`.env.example`**.

**Edge settings file:** [`barricade_config.json`](barricade_config.json) — camera and RFID mode; the API Agent can serve/update this via **`GET` / `PUT /config`** (dashboard Configuration page).

---

## Run the edge stack

**Recommended — dedicated run script:**

```bash
./run-barricade.sh
```

Starts four processes (order tuned for dependencies):

| Service | Port | Notes |
|---------|------|--------|
| **api_agent** | 8080 | HTTP + WebSocket `ws://localhost:8080/ws` |
| **anpr_service** | 8001 | `GET /health`, `GET /video_feed` (MJPEG), `POST /capture` |
| **rfid_service** | 8002 | Mock RFID; `GET /ui`, `POST /trigger` |
| **dashboard_service** | 5173 | Vite dev server (`npm run dev`); use **agent mode** for production-style UI (see dashboard README) |

Press **Ctrl+C** to stop all child processes.

**Optional environment variables:**

```bash
SKIP_ANPR=1 ./run-barricade.sh       # Skip ANPR (no camera / ML)
SKIP_DASHBOARD=1 ./run-barricade.sh  # Skip the Vite dashboard only
```

If `node_modules` is missing, `run-barricade.sh` runs `npm install` in `dashboard_service/` before starting the dashboard.

**Central backend:** this script does **not** start **`backend-service`**. Run the API separately (e.g. `../backend-service/run-backend.sh`) and set **`BACKEND_BASE_URL=http://localhost:8000`** (and matching **`VITE_BACKEND_URL`**) for full integration.

---

## How it fits together

```
  RFID (mock) ──POST /rfid/scan──► API Agent ◄──WebSocket──► Dashboard
                                       │    MJPEG /capture
                                       ├──► ANPR :8001
                                       └──► Central API :8000 (verify + JWT admin)
```

- The **dashboard** talks to the **API Agent** for live verification and to the **central backend** for login and admin CRUD when **`VITE_BACKEND_URL`** is set.
- **Central backend liveness** (“Server” in the header) comes from the agent polling **`GET …/health/live`** and pushing **`backend_health`** over the WebSocket — the browser does not poll the backend for that.

---

## Overview of components

| Component | README |
|-----------|--------|
| **ANPR Service** | [anpr_service/README.md](anpr_service/README.md) — YOLOv8 + EasyOCR + SORT; MJPEG + `/capture` |
| **API Agent** | [api_agent/README.md](api_agent/README.md) — FastAPI + WebSocket; RFID ingest, backend verify, ANPR pipeline |
| **RFID Service** | [rfid_service/README.md](rfid_service/README.md) — Mock reader; push-only `{ "rfid_tag" }` to the agent |
| **Dashboard** | [dashboard_service/README.md](dashboard_service/README.md) — Vite + React + Material UI; gate UI + `/admin` |

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
├── bin/setup              # Install: uv sync + .env bootstrap + npm (dashboard)
├── bin.setup              # Wrapper → bin/setup
├── run-barricade.sh       # Run: api_agent, anpr_service, rfid_service, dashboard
├── barricade_config.json  # Edge camera / RFID settings (agent /config)
├── api_agent/
├── anpr_service/
├── rfid_service/
├── dashboard_service/
├── pyproject.toml         # uv workspace
├── .env.example
├── CONTEXT.MD
└── README.md
```

---

## Dependencies

See `pyproject.toml`. Notable stack: **Ultralytics YOLOv8**, **EasyOCR**, **OpenCV**, **FastAPI**, **httpx**; dashboard uses **React 19** and **Material UI** (see `dashboard_service/package.json`).

---

## Roadmap (high level)

Remaining work is documented in **`CONTEXT.MD`**: hardware RFID, offline queue, image snapshots (e.g. S3), production TLS/mTLS to the cloud, monitoring, optional **`employee_id`** on all verify paths, and agent/WebSocket hardening if exposed beyond a trusted LAN.

---

## Acknowledgments

- [Ultralytics YOLOv8](https://github.com/ultralytics/ultralytics)
- [SORT](https://github.com/abewley/sort)
- [EasyOCR](https://github.com/JaidedAI/EasyOCR)
