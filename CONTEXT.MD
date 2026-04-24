# Mine Site Anti-Theft Vehicle Detection System — Barricade Edge

**Last updated:** 2026-04-25

**Purpose:** Restore **full project context** for `barricade-service/` (local edge). Central API + DB live in **`backend-service/`** (e.g. AWS).

> **Architecture updates (April 2026):**
>
> 1. **Single ingress via API Agent.** The dashboard no longer calls the backend directly — it hits the agent on `/api/*`, and the agent proxies to `BACKEND_BASE_URL`. `/api/verify/*` is blocked at the proxy (agent-internal only via `X-API-Key`). `VITE_BACKEND_URL` now points at the **API Agent origin**, not the backend.
> 2. **Real RFID hardware over USB serial.** The RFID service now reads tags from an Arduino (MFRC522) via `pyserial` and writes the `open_gate` command back over the same port when verification succeeds. Mock mode is still supported for hardware-free dev. Mode / port / baud are **hot-reloadable from the dashboard Configuration page** — no service restart required.
> 3. **Bidirectional serial actuator.** On a successful RFID + ANPR flow (or an operator clicking "Open Barricade") the agent calls `POST /gate/open` on the local RFID service, which writes `open_gate\n` to the Arduino. The sketch drives the servo / LED and auto-closes on a timer.

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
                        │     :8000  FastAPI + MongoDB (Atlas)    │
                        │                                         │
                        │  X-API-Key  →  /api/verify/*            │
                        │  Bearer JWT →  /api/auth, /api/orders…  │
                        └────────────────────▲────────────────────┘
                                             │ HTTP/HTTPS
                                             │ (agent is the ONLY caller)
 ┌───────────────────────────────────────────┴────────────────────────────────┐
 │  GATE PC — barricade-service/                                              │
 │                                                                             │
 │    ┌──────────────┐                                                         │
 │    │ Arduino Uno  │  USB serial  (bidirectional, one line per message)     │
 │    │ MFRC522+servo│◄──────────────────────────────────────────┐            │
 │    │ NeoPixel     │   tag bytes                               │            │
 │    │              │─────► EVT:SYSTEM_READY, <tag>, EVT:GATE_* │            │
 │    └──────▲───────┘                                           │            │
 │           │ open_gate\n                                       │            │
 │           │                                                   │            │
 │   ┌───────┴─────────┐    POST /rfid/scan    ┌─────────────────┼─────────┐ │
 │   │ RFID Svc :8002  │──────────────────────►│ API Agent :8080           │ │
 │   │ serial reader   │◄──POST /gate/open─────│ HTTP + WS                  │ │
 │   │ (pyserial)      │                       │                            │ │
 │   └─────────────────┘                       │  ┌────────────────────┐   │ │
 │                                             │  │ /api/* proxy       │───┼─► backend
 │   ┌─────────────────┐                       │  │  browser Bearer JWT│   │ │
 │   │ ANPR :8001      │◄──────POST /capture───│  │  /api/verify → 404 │   │ │
 │   │ MJPEG + /capture│                       │  └────────────────────┘   │ │
 │   └──────▲──────────┘                       └──────┬──────┬─────────────┘ │
 │          │ GET /video_feed                         │WS    │REST /api/*   │ │
 │          │                                         ▼      ▼              │ │
 │          │                                 ┌──────────────────┐          │ │
 │          └─────────────────────────────────│ Dashboard :5173  │          │ │
 │                                            │ (never calls the │          │ │
 │                                            │  backend direct) │          │ │
 │                                            └──────────────────┘          │ │
 │                                                                           │ │
 │   Agent polls GET …/health/live → pushes backend_health on WS             │ │
 └───────────────────────────────────────────────────────────────────────────┘
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
| **rfid_service** | 8002 | `GET /ui`, `POST /trigger` (mock), `POST /gate/open` (writes `open_gate\n` to Arduino), `GET /health` (reports `serial.{port,connected,last_error}`) |
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
| **RFID Service** | ✅ Serial + Mock | `rfid_service/` — **Bidirectional over USB serial:** a `pyserial` daemon thread reads tag lines from an Arduino and pushes `{ "rfid_tag" }` to API Agent `POST /rfid/scan`; `POST /gate/open` writes `open_gate\n` back over the same port to actuate the barrier. Mode / port / baud come from `rfid.*` in `barricade_config.json` (env vars take precedence) and **hot-reload** whenever the JSON changes — dashboard Configuration page writes the JSON. Auto-detects the Arduino by USB VID when the port is unset (2341 / 2A03 / CH340 / FTDI / CP210x). Mock mode (`POST /trigger`, `/ui`) still available for hardware-free dev. Status lines prefixed `EVT:` on the wire are filtered so they don't land in the RFID ingest path. |
| **Gate actuator** | ✅ | Agent's `_emit_gate_open(method)` in `services/verification.py` fires after successful RFID + ANPR (auto flow), after manual plate with auto-open, and on the "Open Barricade" button. Broadcasts `gate_decision` to the dashboard AND calls `POST {RFID_SERVICE_URL}/gate/open` (default `http://localhost:8002`). On wire: Python writes `open_gate\n`, sketch opens servo / LED and auto-closes on a timer. Best-effort: actuator failure logs a warning but does not break the verification flow. |
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
| **Hardening / ops** | Offline queue, snapshot storage to S3, production TLS/mTLS agent↔backend, monitoring. |
| **Deeper integration** | Optional end-to-end polish for `employee_id` on all verify paths if product requires it everywhere. |
| **Multi-board support** | One serial port per gate PC today. If a site ever runs multiple Arduinos on one host, the reader needs to be parameterised per instance (or split into a reader per port). |

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

### Live path (real hardware)

1. **Tag scan** — Arduino (MFRC522) reads a card and prints the decoded tag string on a single serial line. The `rfid_service` serial reader picks it up and `POST`s `{ "rfid_tag" }` to **API Agent** `POST /rfid/scan`.
2. **RFID verify** — Agent broadcasts `rfid_scanning`, calls backend **`POST /api/verify/rfid`** with `X-API-Key`, broadcasts `rfid_check_result`.
3. **If RFID VALIDATED** — Agent starts **ANPR pipeline** (async): `anpr_processing` → **`POST ANPR /capture`** (retries + `anpr_retry` / `anpr_manual` if needed) → backend **`POST /api/verify/anpr`** → broadcasts `anpr_result`.
4. **Gate decision** — On ANPR success **only if** "Open Automatically" is on (`session.auto_open_after_verify`): agent calls backend **`POST /api/verify/gate-open`** (entry log + order completion), then `_emit_gate_open("auto")` broadcasts `gate_decision` AND fires **`POST {RFID_SERVICE_URL}/gate/open`**. The RFID service writes **`open_gate\n`** over serial; the Arduino opens the servo, flips the LED green, and emits `EVT:GATE_OPENED`.
5. **Auto-close** — Arduino closes the servo `REMOVE_TIMEOUT` ms after the card leaves the reader (or after the `open_gate` command if no card is present). Emits `EVT:GATE_CLOSED`. Python never sends a close command.
6. **Dashboard** — Subscribes via WebSocket; **`set_auto_open`**, **manual plate**, and **open gate** go to the agent when connected. Toggle **Open Automatically** updates reducer `autoOpenEnabled` and syncs **`set_auto_open`** so the agent session matches the UI. Clicking **Open Barricade** triggers the same `_emit_gate_open("manual")` path, firing the physical actuator with `method: "manual"`.
7. **Simulate** — `simulate` / `start_verification` runs a **timed mock** RFID → ANPR flow. `gate_decision` in this path is **send-to-sender only** (not broadcast) and **does not** call `/gate/open`, so demos don't actuate hardware.

### Verification flow (state machine)

High-level: **RFID → ANPR → gate** (see `useVerificationState.js` for UI states).

---

## 4. System architecture

```
BARRICADE LOCAL SYSTEM (one per entry point)
├── Arduino (MFRC522+servo+NeoPixel)   ✅ USB serial — tags out, open_gate in
├── RFID Service                       ✅ pyserial reader + /gate/open writer
│                                      ├── read loop: forward tag → agent
│                                      ├── write path: POST /gate/open → serial
│                                      └── hot-reloads rfid.* from JSON
├── ANPR Service                       ✅ YOLO+EasyOCR (MJPEG + /capture)
├── API Agent                          ✅ FastAPI + WebSocket orchestrator
│                                      ├── routes: root, health, rfid_scan, ws,
│                                      │           config, proxy (/api/*)
│                                      ├── services: verification (auto-fires
│                                      │             /gate/open), session,
│                                      │             backend_client (X-API-Key)
│                                      └── polls backend health → backend_health
└── React Dashboard                    ✅ Vite + MUI — gate UI + /admin (JWT)

CENTRAL BACKEND (backend-service/ — cloud or local :8000)
├── Verification APIs     ✅ /api/verify/*   (only API Agent calls these)
├── Data + alerts         ✅ MongoDB (Beanie; Atlas in production)
└── Users + JWT           ✅ /api/auth/login, RBAC for CRUD
                              (reached via agent proxy, not browser)
```

### Communication matrix

| From | To | Protocol | Status |
|------|----|----------|--------|
| Arduino | RFID Service | USB serial line (9600 baud default) | ✅ Tag lines + `EVT:*` status lines |
| RFID Service | Arduino | USB serial write (`open_gate\n`) | ✅ Only when agent fires `POST /gate/open` |
| RFID Service | API Agent | HTTP `POST /rfid/scan` `{ "rfid_tag" }` | ✅ One-way (status lines filtered) |
| API Agent | RFID Service | HTTP `POST /gate/open` | ✅ After verified open or manual "Open Barricade" |
| Dashboard | API Agent | WebSocket | ✅ `ws://…/ws` (`VITE_API_AGENT_HOST`) |
| Dashboard | ANPR Service | HTTP MJPEG | ✅ `http://…/video_feed` (`VITE_ANPR_HOST`) |
| Dashboard | API Agent `/api/*` proxy | HTTP REST + Bearer JWT | ✅ When `VITE_BACKEND_URL` is set — login + admin CRUD. `VITE_BACKEND_URL` points at the **agent**, not the backend. |
| Dashboard | API Agent `/config` | HTTP `GET` / `PUT` | ✅ Admin Configuration page reads/writes `barricade_config.json`; RFID fields hot-reload |
| API Agent | Dashboard | WebSocket | ✅ Events per `core/events.py` + `backend_health` |
| API Agent | ANPR Service | HTTP `POST /capture` | ✅ |
| API Agent | Backend (verify) | HTTP REST + `X-API-Key` | ✅ `POST /api/verify/*` via `services/backend_client.py` |
| API Agent | Backend (proxy passthrough) | HTTP REST + forwarded Bearer JWT | ✅ `GET/POST/PUT/PATCH/DELETE /api/*` except `/api/verify/*` (blocked 404) |
| API Agent | Backend | Health poll | ✅ `GET …/health/live` → WS `backend_health` to dashboard |

**Liveness:** The **browser does not** poll the central backend for "Server" status; the **API Agent** does and forwards via **`backend_health`**.

**Backend direct access:** the browser never calls the central backend directly. This means:
- Only the API Agent's public origin (`:8080`) needs to be reachable from the dashboard. The backend can sit on a private/locked-down port.
- Backend CORS (`CORS_ORIGINS`) becomes irrelevant to the edge — only the agent's CORS matters for the browser.

### Serial protocol (Arduino ↔ RFID service)

One USB-serial link, one baud rate, bidirectional ASCII lines terminated with `\n`. Reference sketch at project root: **`gate_control_script.ino`** (MFRC522 reader + servo + NeoPixel).

**Arduino → Python**

| Line | Meaning | Python behavior |
|------|---------|-----------------|
| `<tag>` (no prefix) | RFID tag ID | forwarded to API Agent `POST /rfid/scan` as `{ "rfid_tag": "<tag>" }` |
| `EVT:SYSTEM_READY` | sketch booted | logged at INFO, **not** forwarded |
| `EVT:GATE_OPENED` | servo moved to open | logged at INFO, **not** forwarded |
| `EVT:GATE_CLOSED` | servo moved to closed | logged at INFO, **not** forwarded |
| anything else starting with `EVT:` | future sketch events | logged at INFO, **not** forwarded |

Tag lines must not start with `EVT:` — everything else is pushed to the backend, so spurious debug prints become `rfid_unknown` alerts.

**Python → Arduino**

| Line | Sent when | Arduino behavior |
|------|-----------|-------------------|
| `open_gate` | Agent calls `POST /gate/open` (successful auto flow, manual plate + auto-open, or operator clicks "Open Barricade") | `openGate()`: servo 90°, LED green, emits `EVT:GATE_OPENED`; auto-closes on `REMOVE_TIMEOUT` |

Gate close is sketch-driven; Python never sends a close command.

### Serial reader internals

`rfid_service/serial_reader.py` — `SerialReader` runs a daemon thread with these properties:

- **Auto-detect** by USB VID when the port is blank: genuine Arduino (`0x2341`, `0x2A03`), CH340 (`0x1A86`), FTDI (`0x0403`), CP210x (`0x10C4`).
- **Reconnects** on `serial.SerialException` with a 3-second backoff; no-port state retries every 5 seconds.
- **Arduino bootloader settle**: 1.5-second sleep after opening the port (Arduino resets on DTR).
- **Hot-reload**: the loop captures `stat().st_mtime` of `barricade_config.json` at connect time and checks it on each `readline` timeout. When the dashboard's `PUT /config` rewrites the JSON the reader breaks the connection, re-reads `rfid_mode() / rfid_serial_port() / rfid_baud_rate()`, and reconnects. Changes apply in ≈ 1 s.
- **Idles when `mode != "serial"`**: the thread still runs in mock mode (polls config every 2 s) so flipping the mode from the dashboard picks up the reader with no service restart.
- **Thread-safe writes**: `send_command(line)` takes a `Lock`, writes `line.rstrip("\r\n") + "\n"` as ASCII, and `flush()`es. Returns `False` if the port isn't open so the caller can 503.

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
| Hardware | Arduino Uno + MFRC522 RFID + servo + NeoPixel (sketch: `gate_control_script.ino`) |
| ANPR | Python, YOLOv8, EasyOCR, OpenCV (Ultralytics); FastAPI (`anpr_service/server.py`) |
| RFID Service | Python, FastAPI, httpx, **pyserial** |
| API Agent | Python, FastAPI, httpx, WebSocket |
| Dashboard | React 19, Vite, Material UI v5, WebSocket |
| Backend | Python, FastAPI, MongoDB, Beanie (see `backend-service/`) |

---

## 10. Key design decisions

1. **RFID ingest is unidirectional at the HTTP layer** — The RFID service only POSTs tags to the agent; it never pulls business data back. The bidirectional part lives one layer lower, on the USB serial link to the Arduino.
2. **One process owns the serial port** — Only `rfid_service` opens the Arduino. The agent never touches serial; it reaches the device via `POST /gate/open`. This avoids the classic two-process serial contention bug and keeps the reader loop authoritative.
3. **Arduino debounces; Python forwards verbatim** — The sketch is responsible for avoiding repeat reads of a held card. Python pushes every non-`EVT:` line it receives.
4. **Status lines use `EVT:` prefix** — Without it, `SYSTEM_READY` / `GATE_OPENED` / `GATE_CLOSED` would pollute the RFID ingest path and show up in `alerts` as `rfid_unknown`.
5. **Backend is remote** — Barricade `.env` points `BACKEND_BASE_URL` at cloud or localhost for dev.
6. **API Agent orchestrates and fronts the backend** — WebSocket to dashboard; HTTP to ANPR; `X-API-Key` to backend `/api/verify/*`; pass-through proxy at `/api/{path:path}` for browser-driven CRUD + JWT login; health poll for `backend_health`.
7. **Dashboard is single-ingress** — The browser talks only to the agent. `VITE_BACKEND_URL` is the **agent** origin, not the backend. The proxy forwards the `Authorization: Bearer <JWT>` unchanged, so backend JWT auth + RBAC are preserved per user. `/api/verify/*` is blocked at the proxy (agent-internal only).
8. **ANPR** — `POST /capture` for verification; MJPEG `video_feed` for preview.
9. **Mock vs live** — `simulate` is timed mock and never touches hardware (doesn't call `/gate/open`). Real RFID uses backend + ANPR pipeline and does.
10. **Open Automatically** — Enforced in **reducer** and on **API agent** (`auto_open_after_verify`). A single helper `_emit_gate_open(method)` in `services/verification.py` broadcasts the dashboard event AND fires the physical actuator, so all three gate-open paths (auto flow / manual plate + auto-open / manual button) stay in sync.
11. **Hot-reload over mtime**, not an HTTP hook — when the dashboard's `PUT /config` writes `barricade_config.json`, the serial reader notices the mtime change on its next 1-second read timeout and reconnects with the new settings. No service-to-service notify API needed.

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
│   ├── app.py                # FastAPI: /health, /ui, /trigger, /gate/open
│   ├── serial_reader.py      # pyserial daemon thread: read tags, write open_gate, hot-reload
│   ├── push.py               # httpx POST /rfid/scan to API Agent
│   ├── service.py            # MockRFIDQueue (fallback when mode=mock)
│   ├── mock_data.py
│   ├── config.py             # reads barricade_config.json + env overrides
│   ├── logging_config.py
│   ├── main.py
│   └── pyproject.toml        # includes pyserial>=3.5
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

- Snapshot storage (S3 vs local) and retention.
- TLS for agent ↔ cloud backend; API keys / IAM rotation.
- Whether to require `employee_id` on all verify calls for audit (partially wired today).
- Multi-Arduino support if a single gate PC ever drives more than one lane.
- Richer hardware protocol (close gate command, heartbeat, firmware version announce) — not needed for the 2-factor demo but natural next steps.
