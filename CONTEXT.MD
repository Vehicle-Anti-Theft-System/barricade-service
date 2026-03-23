# Mine Site Anti-Theft Vehicle Detection System — Barricade Edge

## Implementation Status (last updated: 2026-03)

> Use this file to restore full project context in any future conversation.  
> **Scope:** `barricade-service/` only (local edge). Central backend lives in `backend-service/` (typically deployed on AWS).  
> **Full combined snapshot (edge + backend):** `../backend-service/context_old.md`.

### Deployment model

| Location | What runs |
|----------|-----------|
| **Local (gate PC)** | `barricade-service`: **api_agent**, **anpr_service**, **rfid_service**, **dashboard_service**. Start all four with `./run-barricade.sh` (does **not** start the backend). |
| **Remote (e.g. AWS)** | **backend-service**: FastAPI + MongoDB (verification, CRUD, alerts). |
| **Configuration** | In `barricade-service/.env`: `BACKEND_BASE_URL` (HTTPS API base, no trailing slash), `DEFAULT_BARRICADE_ID` (UUID of this gate in the remote DB). Optional: `RUN_LOCAL_BACKEND` is **not** used by `run-barricade.sh`; run `backend-service` separately for local dev with `BACKEND_BASE_URL=http://localhost:8000`. |

### Default ports (local edge)

| Service | Port | Notes |
|---------|------|--------|
| **api_agent** | 8080 | HTTP + WebSocket `ws://localhost:8080/ws` |
| **anpr_service** | 8001 | `GET /health`, `GET /video_feed` (MJPEG), `POST /capture` |
| **rfid_service** | 8002 | `GET /ui`, `POST /trigger`, `GET /health` |
| **dashboard_service** | 5173 | Vite dev (`npm run dev`); `VITE_*` hosts in `.env` |

---

### ✅ DONE (barricade edge)

| Component | Status | Notes |
|-----------|--------|------|
| **2-factor verification** | ✅ | **RFID + ANPR only** (no fingerprint; see `backend-service` for schema). |
| **ANPR library** | ✅ | `anpr_service/anpr_service.py` — YOLOv8 + EasyOCR + SORT: `process_image`, `process_video`, `process_camera`, `capture_and_process_frame`. |
| **ANPR HTTP server** | ✅ | `anpr_service/server.py` — FastAPI: `GET /health`, `GET /video_feed` (MJPEG for dashboard), `POST /capture` (single-frame plate read). Entry: `uv run anpr-service` or workspace script. |
| **API Agent** | ✅ | `api_agent/` — FastAPI + WebSocket `/ws`. Routes: `GET /`, `GET /health`, `POST /rfid/scan`, `WebSocket /ws`. **Live flow:** RFID ingest → backend `POST /api/verify/rfid` → on success, background **ANPR pipeline** (`POST` local ANPR `/capture` → backend `POST /api/verify/anpr` → optional `POST /api/verify/gate-open`) → WebSocket events. **Mock flow:** `simulate` / `start_verification` for demos. **Session:** `services/session.py` holds RFID context for `manual_plate` / `open_gate`. **Config:** `api_agent/config.py` (`BACKEND_BASE_URL`, `ANPR_SERVICE_URL`, `DEFAULT_BARRICADE_ID`, retries). |
| **RFID Service** | ✅ Mock | `rfid_service/` — **Unidirectional:** only **sends** `{ "rfid_tag" }` to API Agent `POST /rfid/scan`. `POST /trigger` cycles mock tags + `httpx` POST; `GET /ui` for testing. **No** pull/peek/list APIs. `config.py`: `API_AGENT_RFID_INGEST_URL`. |
| **React Dashboard** | ✅ | `dashboard_service/` — Vite + React + **Material UI** (`@mui/material`). Login (`useAuth`), verification UI, `useVerificationState` (RFID + ANPR), `useWebSocket`, `constants.js` (`WEBSOCKET_URL`, `MJPEG_STREAM_URL` via `VITE_*`). |
| **Camera feed** | ✅ | `CameraFeed.jsx` → `http://<VITE_ANPR_HOST>/video_feed` with placeholder on error. |
| **WebSocket protocol** | ✅ | Events/commands in `api_agent/core/events.py`; dashboard reducer aligns with `rfid_scanning`, `rfid_check_result`, `anpr_processing`, `anpr_result`, `anpr_retry`, `anpr_manual`, `gate_decision`, `session_reset`. |
| **Run script** | ✅ | `run-barricade.sh` — starts **api_agent → anpr_service → rfid_service → dashboard_service** (order tuned for dependencies). Optional `SKIP_ANPR=1`, `SKIP_DASHBOARD=1`. Loads `.env`. |
| **Logging** | ✅ | `LOG_LEVEL` in `.env`. API Agent: `logging_config.py`, logs on routes, verification, session, RFID ingest, WebSocket. ANPR `server.py`, RFID `logging_config.py` + module loggers. Dashboard: `src/utils/logger.js` (`BARRICADE_LOG_LEVEL` in localStorage). |
| **Documentation** | ✅ | `README.md`, `api_agent/README.md`, `anpr_service/README.md`, `rfid_service/README.md`, `dashboard_service/README.md`, `.env.example`. |
| **Root `main.py`** | ⚠️ | Optional demo script processing a static image via ANPR library (not part of the four-service runtime). |

### Central backend (outside this repo path)

| Component | Status | Notes |
|-----------|--------|------|
| **backend-service** | ✅ Implemented | See `../backend-service/CONTEXT.MD` — MongoDB (Beanie), verification APIs (`/api/verify/rfid`, `/anpr`, `/gate-open`), alerts, CRUD. Deployed separately (e.g. AWS). |

### ❌ NOT DONE (what’s left)

| Item | Notes |
|------|--------|
| **RFID hardware** | Replace mock queue + `POST /trigger` with serial/SDK reader; keep same push-only contract to API Agent. |
| **Admin panel** | Order/driver/truck management UI (backend may already expose APIs). |
| **Hardening** | Offline queue, snapshot storage to S3, production TLS/mTLS for agent↔backend, etc. |

---

## 1. Problem Statement

At mine sites in India, cargo theft (coal, fuel, etc.) occurs through **truck-driver swapping** (wrong truck, swapped plates, collusion). There is no automated way to ensure the **correct truck + correct plate** for the **registered order** at the gate.

### Deployment model (summary)

- **Barricade edge** (`barricade-service/`): runs on the **local PC** at the gate.
- **Central backend** (`backend-service/`): runs **remotely** (e.g. **AWS**): FastAPI + MongoDB.
- API Agent reaches the backend only via **`BACKEND_BASE_URL`** in `barricade-service/.env` (no bundled backend in `run-barricade.sh`).

---

## 2. Solution Overview

**2-factor verification** at the barricade: **RFID** (truck tag) then **ANPR** (license plate). Both must match the order in the central DB. **Fingerprint** is not used.

---

## 3. How It Works — End to End (implemented behavior)

### Preconditions

- Order + truck + driver exist in the **remote** backend DB; barricade record exists; `DEFAULT_BARRICADE_ID` matches this gate.

### Live path (hardware / mock trigger)

1. **RFID** — `rfid_service` sends a tag to **API Agent** `POST /rfid/scan` (one-way). Agent broadcasts `rfid_scanning`, calls backend **`POST /api/verify/rfid`**, broadcasts `rfid_check_result`.
2. **If RFID VALIDATED** — Agent starts **ANPR pipeline** (async): `anpr_processing` → **`POST ANPR /capture`** (retries + `anpr_retry` / `anpr_manual` if needed) → backend **`POST /api/verify/anpr`** → broadcasts `anpr_result`; on success may call **`POST /api/verify/gate-open`** and `gate_decision`.
3. **Dashboard** — Subscribes via WebSocket; **manual plate** and **open gate** commands go to the agent when connected.
4. **Simulate** — `simulate` / `start_verification` runs **mock** delays only (no backend), for UI demos.

### Verification flow (state machine)

High-level: **RFID → ANPR → gate** (see `useVerificationState.js` for UI states).

---

## 4. System Architecture

```
BARRICADE LOCAL SYSTEM (one per entry point)
├── RFID Service          ✅ Mock — push-only POST → API Agent /rfid/scan
├── ANPR Service          ✅ Library + FastAPI HTTP (MJPEG + /capture)
├── API Agent             ✅ FastAPI + WebSocket orchestrator
│                         ├── routes: root, health, rfid_scan, ws
│                         ├── services: verification (mock + live), session
│                         └── config: BACKEND_BASE_URL, ANPR_SERVICE_URL, …
└── React Dashboard       ✅ Vite + MUI

CENTRAL BACKEND (backend-service/ — AWS / cloud)
├── Verification Service  ✅ RFID + ANPR + gate-open
├── Data/Query / Alerts   ✅ MongoDB (Beanie)
└── Admin Panel           ❌
```

### Communication

| From | To | Protocol | Status |
|------|----|----------|--------|
| Dashboard | API Agent | WebSocket | ✅ `ws://localhost:8080/ws` (configurable via `VITE_API_AGENT_HOST`) |
| Dashboard | ANPR Service | HTTP MJPEG | ✅ `http://localhost:8001/video_feed` (via `VITE_ANPR_HOST`) |
| API Agent | Dashboard | WebSocket | ✅ Events per `core/events.py` |
| RFID Service | API Agent | HTTP POST `{ "rfid_tag" }` → `/rfid/scan` | ✅ One-way |
| API Agent | ANPR Service | HTTP `POST /capture` | ✅ |
| API Agent | Backend | HTTPS REST | ✅ When `BACKEND_BASE_URL` + `DEFAULT_BARRICADE_ID` set |

---

## 5. Frontend State Machine

Implemented in `dashboard_service/src/constants.js` and `useVerificationState.js`.

### RFID states

`WAITING` | `SCANNING` | `IN_PROGRESS` | `VALIDATED` | `FAILED`

### ANPR states

`ON_HOLD` | `TRIGGERED` | `PROCESSING` | `RETRY` | `MANUAL_ENTRY` | `IN_PROGRESS` | `VALIDATED` | `FAILED`

### WebSocket — outbound (API Agent → Dashboard)

Event names are in `api_agent/core/events.py`. Typical payloads:

- `rfid_scanning`
- `rfid_check_result` — `status`, `rfid`, optional `order_id`, `truck_id`, `driver_name`, `expected_plate`, or failure `detail` / `alert_type`
- `anpr_processing`
- `anpr_retry` — `attempt`
- `anpr_manual` — after max capture retries without plate
- `anpr_result` — `status`, `plate`, `confidence`, optional mismatch fields
- `gate_decision` — `open`, `method` (`auto` | `manual`)
- `session_reset`
- `alert_raised` (when used)

### WebSocket — inbound (Dashboard → API Agent)

- `simulate` / `start_verification` — mock flow; optional `auto_open`, `employee_id`
- `session_reset`
- `manual_plate` — `{ "plate": "..." }`
- `open_gate`

---

## 6. Alert System

Backend (`backend-service/`) creates alerts on verification failures. Types include `rfid_unknown`, `rfid_no_order`, `plate_mismatch`, `plate_swap_suspected`. Details: `backend-service/CONTEXT.MD`.

---

## 7. Database Schema

**Not in this repo.** Central data lives in **MongoDB** in the backend deployment. Collections and fields: see **`backend-service/CONTEXT.MD`**. Do not assume SQL/Alembic unless the backend doc says so.

---

## 8. Build Roadmap (condensed)

| Phase | Items |
|-------|--------|
| **Edge core** | [x] ANPR library + HTTP server; [x] API Agent + RFID ingest + live ANPR pipeline; [x] Dashboard; [x] `run-barricade.sh`; [x] env + logging |
| **RFID hardware** | [ ] Serial/SDK reader, same push-only API |
| **Backend** | [x] In `backend-service/` (separate deploy) |
| **Integration** | [x] Agent → backend (config-driven); tune retries, TLS, timeouts |
| **Admin / ops** | [ ] Admin UI; snapshots; offline queue; monitoring |

---

## 9. Tech Stack

| Layer | Technology |
|-------|------------|
| ANPR | Python, YOLOv8, EasyOCR, OpenCV (Ultralytics); FastAPI server (`anpr_service/server.py`) |
| RFID Service | Python, FastAPI, httpx |
| API Agent | Python, FastAPI, httpx, WebSocket |
| Dashboard | React 19, Vite, Material UI (`@mui/material`), WebSocket |
| Backend | Python, FastAPI, MongoDB, Beanie (see `backend-service/`) |

---

## 10. Key Design Decisions

1. **RFID is unidirectional** — Edge never pulls business data from the API Agent; only HTTP POST `{ rfid_tag }` to ingest.
2. **Backend is remote** — Barricade `.env` points `BACKEND_BASE_URL` at AWS (or localhost for dev).
3. **API Agent orchestrates** — WebSocket to dashboard; HTTP to ANPR and backend.
4. **ANPR** — `POST /capture` for verification; MJPEG `video_feed` for preview.
5. **Mock vs live** — `simulate` avoids backend; real RFID trigger uses backend + ANPR pipeline.
6. **Demo mode** — If WebSocket disconnects, dashboard can run local demo timers (`useWebSocket` + `enableDemoMode`).
7. **Employee login** — Mock auth in `useAuth` (extend to backend later).

---

## 11. Project Structure

```
barricade-service/
├── anpr_service/
│   ├── anpr_service.py
│   ├── server.py           # FastAPI: /health, /video_feed, /capture
│   ├── utility.py
│   ├── sort/
│   ├── pyproject.toml
│   └── README.md
├── api_agent/
│   ├── core/               # events.py, connection.py
│   ├── routes/             # root, health, rfid_scan, ws
│   ├── services/         # verification.py, session.py
│   ├── config.py
│   ├── logging_config.py
│   ├── app.py
│   ├── main.py
│   └── pyproject.toml
├── rfid_service/
│   ├── app.py
│   ├── push.py
│   ├── service.py
│   ├── mock_data.py
│   ├── config.py
│   ├── logging_config.py
│   ├── main.py
│   └── pyproject.toml
├── dashboard_service/
│   └── src/
│       ├── components/
│       ├── hooks/          # useVerificationState, useWebSocket, useAuth
│       ├── utils/logger.js
│       ├── constants.js
│       ├── App.jsx / AppAgent.jsx
│       └── ...
├── run-barricade.sh        # api_agent, anpr_service, rfid_service, dashboard_service
├── .env.example
├── pyproject.toml          # uv workspace: api_agent, rfid_service, anpr_service
├── main.py                 # Optional static-image ANPR demo (not part of 4-service run)
└── CONTEXT.MD              # this file
```

---

## 12. Open Questions

- RFID reader model and SDK for production.
- Snapshot storage (S3 vs local) and retention.
- TLS for agent ↔ cloud backend; API keys / IAM.
- Replacing mock `useAuth` with backend JWT.
- `employee_id` passed through verify calls end-to-end (partially wired).
