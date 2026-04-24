# Mine Site Anti-Theft Vehicle Detection System — Barricade Edge

**Last updated:** 2026-04-24

**Purpose:** Restore **full project context** for `barricade-service/` (local edge). Central API + DB live in **`backend-service/`** (e.g. AWS).

> **Architecture change (2026-04):** the **API Agent is now the single ingress** for all browser traffic to the central backend. The dashboard no longer calls the backend directly — it calls the agent on `/api/*`, and the agent proxies to `BACKEND_BASE_URL`. `/api/verify/*` is blocked at the proxy (agent-internal only via `X-API-Key`). `VITE_BACKEND_URL` now points at the **API Agent origin**, not the backend.

**Related docs (read these for depth):**

| Document | Scope |
|----------|--------|
| `dashboard_service/CONTEXT.MD` | React dashboard (gate + admin UI) |
| `api_agent/CONTEXT.MD` | API Agent routes, session, events |
| `../backend-service/CONTEXT.MD` | FastAPI verify + MongoDB |
| `../backend-service/context_old.md` | **Full system** in one file (edge + backend + dashboard) |

---

## At-a-glance: how the edge fits in

```
                    ┌─────────────────────────────────────────┐
                    │     CENTRAL (backend-service)           │
                    │     :8000  FastAPI + MongoDB            │
                    │                                         │
                    │  X-API-Key  →  /api/verify/*            │
                    │  Bearer JWT →  /api/auth, /api/orders…  │
                    └────────────────────▲────────────────────┘
                                         │ HTTP/HTTPS
                                         │ (agent is the ONLY caller)
    ┌────────────────────────────────────┴────────────────────────────┐
    │  GATE PC — barricade-service/ (THIS REPO FOLDER)                   │
    │                                                                    │
    │   ┌─────────────┐     ┌──────────────────┐     ┌─────────────┐    │
    │   │ RFID :8002 │────►│ API Agent :8080  │────►│ ANPR :8001  │    │
    │   │ (push only)│     │ HTTP + WS        │     │ MJPEG+capture│    │
    │   └─────────────┘     │                  │     └─────────────┘    │
    │                       │  ┌────────────┐  │                        │
    │                       │  │ /api/* proxy│──┼──► backend (/api/*)   │
    │                       │  │  browser   │  │    forwards Bearer JWT │
    │                       │  │  Bearer JWT │  │                        │
    │                       │  │  /api/verify│  │                        │
    │                       │  │   → 404    │  │                        │
    │                       │  └────────────┘  │                        │
    │                       └──────┬──────┬────┘                        │
    │                              │WS    │REST /api/* (via proxy)     │
    │                              ▼      ▼                             │
    │                       ┌──────────────────┐                        │
    │                       │ Dashboard :5173  │                        │
    │                       │ (never talks to  │                        │
    │                       │  the backend     │                        │
    │                       │  directly)       │                        │
    │                       └──────────────────┘                        │
    │                                                                    │
    │  Agent polls GET …/health/live → pushes backend_health on WS      │
    └────────────────────────────────────────────────────────────────────┘
```

---

## Implementation status

> **Scope:** `barricade-service/` only. **`run-barricade.sh` does not start the central backend** — run `backend-service` separately and point `BACKEND_BASE_URL` at it for local integration.

### Deployment model

| Location | What runs |
|----------|-----------|
| **Local (gate PC)** | **api_agent**, **anpr_service**, **rfid_service**, **dashboard_service** — start with `./run-barricade.sh` |
| **Remote (e.g. AWS)** | **backend-service** (FastAPI + MongoDB) |
| **Configuration** | `.env`: `BACKEND_BASE_URL` (HTTPS base, **no** trailing slash), `DEFAULT_BARRICADE_ID` (UUID of this gate in remote DB). `RUN_LOCAL_BACKEND` is **not** consumed by `run-barricade.sh`; use `BACKEND_BASE_URL=http://localhost:8000` when backend runs locally |

### Default ports (local edge)

| Service | Port | Notes |
|---------|------|--------|
| **api_agent** | 8080 | HTTP + WebSocket `ws://localhost:8080/ws` |
| **anpr_service** | 8001 | `GET /health`, `GET /video_feed` (MJPEG), `POST /capture` |
| **rfid_service** | 8002 | `GET /ui`, `POST /trigger`, `GET /health` |
| **dashboard_service** | 5173 | Vite dev; `VITE_*` in `.env` |

---

### Done (barricade edge + aligned products)

| Component | Status | Notes |
|-----------|--------|--------|
| **2-factor verification** | ✅ | **RFID + ANPR only** (no fingerprint; schema in `backend-service`). |
| **ANPR library** | ✅ | `anpr_service/anpr_service.py` — YOLOv8 + EasyOCR + SORT: `process_image`, `process_video`, `process_camera`, `capture_and_process_frame`. |
| **ANPR HTTP server** | ✅ | `anpr_service/server.py` — FastAPI: `GET /health`, `GET /video_feed` (MJPEG), `POST /capture`. |
| **API Agent** | ✅ | `api_agent/` — FastAPI + WebSocket `/ws`. Routes: `GET /`, `GET /health`, `POST /rfid/scan`, `WebSocket /ws`, `GET`/`PUT /config`, and the new **`/api/{path:path}` pass-through proxy** (`routes/proxy.py`) for browser → backend traffic. **Live flow:** RFID ingest → backend `POST /api/verify/rfid` → background **ANPR pipeline** (`POST` ANPR `/capture`, retries, `anpr_manual`) → backend `POST /api/verify/anpr` → **only if** session `auto_open_after_verify` is true: `POST /api/verify/gate-open` + `gate_decision` (auto). **Manual plate:** submitting the plate dialog does **not** auto-open the gate when the flag is false; operator uses **Open Barricade** (`open_gate`). **Mock flow:** `simulate` / `start_verification` with optional `auto_open`. **Session:** `services/session.py` — RFID context + `auto_open_after_verify` (not cleared on verification `reset()`). See `api_agent/CONTEXT.MD`. |
| **Backend health on WS** | ✅ | Agent polls `BACKEND_BASE_URL/health/live`, broadcasts `backend_health` to dashboard (header “Server” line). |
| **RFID Service** | ✅ Mock | `rfid_service/` — **Unidirectional:** only **sends** `{ "rfid_tag" }` to API Agent `POST /rfid/scan`. `POST /trigger` cycles mock tags; `GET /ui` for testing. **No** pull/peek/list APIs. |
| **React Dashboard** | ✅ | `dashboard_service/` — Vite + React + **MUI v5**. `App.jsx` (demo) vs `AppAgent.jsx` (agent build). `useVerificationState`: RFID + ANPR + **`autoOpenEnabled`**, activity log (**max 50** rows, FIFO). **Gate:** **Open Barricade** disabled after open until **Rescan** (`session_reset`). **JWT login** + **admin screens** when `VITE_BACKEND_URL` set — see `dashboard_service/CONTEXT.MD`. |
| **Camera feed** | ✅ | `CameraFeed.jsx` → `http://<VITE_ANPR_HOST>/video_feed` with placeholder on error. |
| **WebSocket protocol** | ✅ | Events in `api_agent/core/events.py`; dashboard reducer aligns with RFID/ANPR/gate events + **`backend_health`**. |
| **Run script** | ✅ | `run-barricade.sh` — **api_agent → anpr_service → rfid_service → dashboard_service**. Optional `SKIP_ANPR=1`, `SKIP_DASHBOARD=1`. Loads `.env`. |
| **Logging** | ✅ | `LOG_LEVEL` in `.env`. Structured logging in agent, ANPR, RFID; dashboard `src/utils/logger.js` (`BARRICADE_LOG_LEVEL` in localStorage). |
| **Documentation** | ✅ | `README.md`, per-service READMEs, `.env.example`, CONTEXT files. |
| **Root `main.py`** | ⚠️ | Optional demo script processing a static image via ANPR library (not part of the four-service runtime). |

### Central backend (outside this folder)

| Component | Status | Notes |
|-----------|--------|--------|
| **backend-service** | ✅ | `../backend-service/CONTEXT.MD` — MongoDB (Beanie), verify APIs, alerts, CRUD, JWT users. |

### Not done (remaining work)

| Item | Notes |
|------|--------|
| **RFID hardware** | Replace mock queue + `POST /trigger` with serial/SDK reader; **keep** same push-only contract to API Agent. |
| **Hardening / ops** | Offline queue, snapshot storage to S3, production TLS/mTLS agent↔backend, monitoring. |
| **Deeper integration** | Optional end-to-end polish for `employee_id` on all verify paths if product requires it everywhere. |

---

## 1. Problem statement

At mine sites, cargo theft (coal, fuel, etc.) occurs through **truck-driver swapping** (wrong truck, swapped plates, collusion). There is no automated way to ensure the **correct truck + correct plate** for the **registered order** at the gate.

### Deployment model (summary)

- **Barricade edge** (`barricade-service/`): runs on the **local PC** at the gate.
- **Central backend** (`backend-service/`): runs **remotely** (e.g. **AWS**): FastAPI + MongoDB.
- API Agent reaches the backend via **`BACKEND_BASE_URL`** in `barricade-service/.env` (`run-barricade.sh` does not bundle the backend).

---

## 2. Solution overview

**2-factor verification** at the barricade: **RFID** (truck tag) then **ANPR** (license plate). Both must match the order in the central DB. **Fingerprint** is not used.

---

## 3. How it works — end to end (implemented)

### Preconditions

- Order + truck + driver exist in the **remote** backend DB; barricade record exists; `DEFAULT_BARRICADE_ID` matches this gate.

### Live path (hardware / mock trigger)

1. **RFID** — `rfid_service` sends a tag to **API Agent** `POST /rfid/scan` (one-way). Agent broadcasts `rfid_scanning`, calls backend **`POST /api/verify/rfid`**, broadcasts `rfid_check_result`.
2. **If RFID VALIDATED** — Agent starts **ANPR pipeline** (async): `anpr_processing` → **`POST ANPR /capture`** (retries + `anpr_retry` / `anpr_manual` if needed) → backend **`POST /api/verify/anpr`** → broadcasts `anpr_result`; on success, **only if “Open Automatically” is enabled** (`auto_open_after_verify`): **`POST /api/verify/gate-open`** and `gate_decision` with `method: "auto"`.
3. **Dashboard** — Subscribes via WebSocket; **`set_auto_open`**, **manual plate**, and **open gate** go to the agent when connected. Toggle **Open Automatically** updates reducer `autoOpenEnabled` and syncs **`set_auto_open`** so the agent session matches the UI.
4. **Simulate** — `simulate` / `start_verification` runs a **timed mock** RFID → ANPR → optional gate (optional `auto_open`). When `BACKEND_BASE_URL` + `DEFAULT_BARRICADE_ID` + API key are set, the mock RFID step can call **`POST /api/verify/rfid`** for a fixed tag (e.g. `TRK-0042`) so session matches the DB.

### Verification flow (state machine)

High-level: **RFID → ANPR → gate** (see `useVerificationState.js` for UI states).

---

## 4. System architecture

```
BARRICADE LOCAL SYSTEM (one per entry point)
├── RFID Service          ✅ Mock — push-only POST → API Agent /rfid/scan
├── ANPR Service          ✅ Library + FastAPI HTTP (MJPEG + /capture)
├── API Agent             ✅ FastAPI + WebSocket orchestrator
│                         ├── routes: root, health, rfid_scan, ws, config,
│                         │           proxy  (/api/{path:path} → backend)
│                         ├── services: verification (mock + live), session,
│                         │             backend_client (X-API-Key → verify)
│                         └── polls backend health → backend_health on WS
└── React Dashboard       ✅ Vite + MUI — gate UI + /admin (JWT via agent proxy)

CENTRAL BACKEND (backend-service/ — cloud or local :8000)
├── Verification APIs     ✅ /api/verify/*   (only API Agent calls these)
├── Data + alerts         ✅ MongoDB (Beanie)
└── Users + JWT           ✅ /api/auth/login, RBAC for CRUD
                              (reached via agent proxy, not browser)
```

### Communication matrix

| From | To | Protocol | Status |
|------|----|----------|--------|
| Dashboard | API Agent | WebSocket | ✅ `ws://…/ws` (`VITE_API_AGENT_HOST`) |
| Dashboard | ANPR Service | HTTP MJPEG | ✅ `http://…/video_feed` (`VITE_ANPR_HOST`) |
| Dashboard | **API Agent `/api/*` proxy** | HTTP REST + Bearer JWT | ✅ When `VITE_BACKEND_URL` is set — login + admin CRUD. `VITE_BACKEND_URL` points at the **agent**, not the backend. |
| API Agent | Dashboard | WebSocket | ✅ Events per `core/events.py` + `backend_health` |
| RFID Service | API Agent | HTTP POST `{ "rfid_tag" }` → `/rfid/scan` | ✅ One-way |
| API Agent | ANPR Service | HTTP `POST /capture` | ✅ |
| API Agent | Backend (verify) | HTTP REST + `X-API-Key` | ✅ `POST /api/verify/*` via `services/backend_client.py` |
| API Agent | Backend (proxy passthrough) | HTTP REST + forwarded Bearer JWT | ✅ `GET/POST/PUT/PATCH/DELETE /api/*` except `/api/verify/*` (blocked 404) |
| API Agent | Backend | Health poll | ✅ `GET …/health/live` → WS `backend_health` to dashboard |

**Liveness:** The **browser does not** poll the central backend for "Server" status; the **API Agent** does and forwards via **`backend_health`**.

**Backend direct access:** the browser never calls the central backend directly. This means:
- Only the API Agent's public origin (`:8080`) needs to be reachable from the dashboard. The backend can sit on a private/locked-down port.
- Backend CORS (`CORS_ORIGINS`) becomes irrelevant to the edge — only the agent's CORS matters for the browser.

### The `/api/*` proxy (agent)

Implemented in `api_agent/routes/proxy.py`. Behavior:

| Aspect | Detail |
|--------|--------|
| **Route** | `/api/{path:path}` on the agent (`:8080`) — accepts `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `OPTIONS` |
| **Upstream** | `BACKEND_BASE_URL/api/{path}` via `httpx.AsyncClient` |
| **Headers forwarded** | All request headers except hop-by-hop (`host`, `content-length`, `connection`, `keep-alive`, `transfer-encoding`, `te`, `upgrade`, `proxy-authorization`, `proxy-authenticate`, `trailer`, `content-encoding`). The browser's `Authorization: Bearer <JWT>` is forwarded unchanged. |
| **Body / method / query string** | Preserved verbatim. |
| **Response** | Status code, body, and headers (minus hop-by-hop) returned to the browser as-is. |
| **`/api/verify/*`** | Returned as **404** at the proxy, never reaches backend. Agent still calls these itself via `services/backend_client.py` using `X-API-Key` (unchanged). |
| **Timeouts** | `BACKEND_HTTP_TIMEOUT_SEC` (default 25s). On transport error → 502. |
| **Auth semantics** | Transparent: the backend's `GateAuthMiddleware` validates the forwarded JWT exactly as before. Per-user RBAC (`admin` / `viewer`) is preserved. The proxy does **not** swap JWT for `X-API-Key`. |

---

## 5. Frontend state machine

Implemented in `dashboard_service/src/constants.js` and `useVerificationState.js`.

### Verification reducer highlights

- **`autoOpenEnabled`** — mirrors **Open Automatically**; persisted across `session_reset` (like the activity log). **`gate_decision`** with `open: true` and `method` other than **`manual`** is **ignored** when this is false.
- **Activity** — up to **50** log rows (FIFO); outcome labels (e.g. RFID verified, Plate verified, OCR retry).
- **`session_reset`** — clears verification state but keeps **logs** (trimmed) and **`autoOpenEnabled`**.

### RFID states

`WAITING` | `SCANNING` | `IN_PROGRESS` | `VALIDATED` | `FAILED`

### ANPR states

`ON_HOLD` | `TRIGGERED` | `PROCESSING` | `RETRY` | `MANUAL_ENTRY` | `IN_PROGRESS` | `VALIDATED` | `FAILED`

### WebSocket — outbound (API Agent → Dashboard)

Event names are in `api_agent/core/events.py`. Typical payloads:

| Event | Role |
|-------|------|
| `rfid_scanning` | RFID read started |
| `rfid_check_result` | `status`, `rfid`, optional `order_id`, `truck_id`, `driver_name`, failure `detail` / `alert_type`. Payloads may include internal fields for UI routing; **user-facing failure copy** should follow backend/dashboard rules so **expected plate** is not taught to operators/attackers at the gate. |
| `anpr_processing` | ANPR started |
| `anpr_retry` | `attempt` |
| `anpr_manual` | After max capture retries without plate |
| `anpr_result` | `status`, `plate`, `confidence`, optional mismatch fields |
| `gate_decision` | `open`, `method` (`auto` \| `manual`) |
| `session_reset` | Full UI reset signal |
| `backend_health` | `{ connected: boolean }` — central backend reachability (from agent poll) |
| `alert_raised` | When used |

### WebSocket — inbound (Dashboard → API Agent)

- `simulate` / `start_verification` — mock flow; optional **`auto_open`** (default true), optional `employee_id` (demo `App.jsx` may send extra fields for **offline** `simulateDemoFlow`; agent uses `auto_open` and ignores unknown keys)
- **`set_auto_open`** — `{ "auto_open": true \| false }` — updates agent session `auto_open_after_verify`
- `session_reset`
- `manual_plate` — `{ "plate": "..." }` — backend ANPR verify; gate open only per `auto_open_after_verify` rules
- `open_gate` — explicit **Open Barricade**; backend gate-open + `gate_decision` (`method: "manual"`) when session valid

---

## 6. Alert system

Backend (`backend-service/`) creates alerts on verification failures. Types include `rfid_unknown`, `rfid_no_order`, `plate_mismatch`, `plate_swap_suspected`, `anpr_failure`. Details: `backend-service/CONTEXT.MD`.

---

## 7. Database schema

**Not in this repo.** Central data lives in **MongoDB** in the backend deployment. Collections and fields: **`backend-service/CONTEXT.MD`**.

---

## 8. Build roadmap (condensed)

| Phase | Items |
|-------|--------|
| **Edge core** | [x] ANPR library + HTTP server; [x] API Agent + RFID ingest + live ANPR pipeline; [x] Dashboard; [x] `run-barricade.sh`; [x] env + logging |
| **RFID hardware** | [ ] Serial/SDK reader, same push-only API |
| **Backend** | [x] In `backend-service/` (separate deploy) |
| **Integration** | [x] Agent → backend (config-driven); [x] backend health → dashboard via WS |
| **Admin / ops** | [x] Admin UI in dashboard (JWT); [ ] snapshots; offline queue; monitoring |

---

## 9. Tech stack

| Layer | Technology |
|-------|------------|
| ANPR | Python, YOLOv8, EasyOCR, OpenCV (Ultralytics); FastAPI (`anpr_service/server.py`) |
| RFID Service | Python, FastAPI, httpx |
| API Agent | Python, FastAPI, httpx, WebSocket |
| Dashboard | React 19, Vite, Material UI v5, WebSocket |
| Backend | Python, FastAPI, MongoDB, Beanie (see `backend-service/`) |

---

## 10. Key design decisions

1. **RFID is unidirectional** — Edge never pulls business data from the API Agent; only HTTP POST `{ rfid_tag }` to ingest.
2. **Backend is remote** — Barricade `.env` points `BACKEND_BASE_URL` at cloud or localhost for dev.
3. **API Agent orchestrates and fronts the backend** — WebSocket to dashboard; HTTP to ANPR; `X-API-Key` to backend `/api/verify/*`; pass-through proxy at `/api/{path:path}` for browser-driven CRUD + JWT login; health poll for `backend_health`.
4. **Dashboard is single-ingress (2026-04)** — The browser talks only to the agent. `VITE_BACKEND_URL` is the **agent** origin, not the backend. The proxy forwards the `Authorization: Bearer <JWT>` unchanged, so backend JWT auth + RBAC are preserved per user. `/api/verify/*` is blocked at the proxy (agent-internal only).
5. **ANPR** — `POST /capture` for verification; MJPEG `video_feed` for preview.
6. **Mock vs live** — `simulate` is timed mock; real RFID uses backend + ANPR pipeline. **`App.jsx`** can use local demo timers when offline; **`AppAgent`** requires the API agent for live flow.
7. **Open Automatically** — Enforced in **reducer** and on **API agent** (`auto_open_after_verify`).
8. **Operator / admin login** — When `VITE_BACKEND_URL` is set, dashboard uses **JWT** via `POST /api/auth/login` **through the agent proxy** (see `dashboard_service/CONTEXT.MD`). Demo mode without backend URL uses legacy mock auth.

---

## 11. Project structure

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
│   ├── routes/             # root, health, rfid_scan, ws, config, proxy
│   ├── services/           # verification.py, session.py, backend_client.py,
│   │                       # backend_health.py
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
│       ├── components/     # GateControl, SessionLog, CameraFeed, …
│       ├── admin/          # Orders, trucks, drivers, config, alerts
│       ├── hooks/          # useVerificationState, useWebSocket, useAuth, …
│       ├── utils/logger.js
│       ├── constants.js
│       ├── App.jsx         # demo + simulation + offline demo
│       ├── AppAgent.jsx    # production-style agent UI
│       └── …
├── run-barricade.sh
├── .env.example
├── pyproject.toml          # uv workspace: api_agent, rfid_service, anpr_service
├── main.py                 # Optional static-image ANPR demo (not 4-service run)
└── CONTEXT.MD              # this file
```

---

## 12. Open questions

- RFID reader model and SDK for production.
- Snapshot storage (S3 vs local) and retention.
- TLS for agent ↔ cloud backend; API keys / IAM rotation.
- Whether to require `employee_id` on all verify calls for audit (partially wired today).
