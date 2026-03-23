# Mine Site Anti-Theft Vehicle Detection System

## Implementation Status (as of 2026-03-18)

> Use this file to restore full project context in any future conversation.

### ✅ DONE

| Component | Status | Notes |
|-----------|--------|------|
| **Alert employee tracking** | ✅ Implemented | Dashboard sends `employee_id` with Start Verification (simulate); API Agent accepts and passes to mock flow (for when backend is wired). Backend stores `employee_id` on alerts — see `backend-service/CONTEXT.MD`. |
| **ANPR Service** | ✅ Library implemented | `anpr_service/` — YOLOv8 + EasyOCR + SORT. Supports `process_image`, `process_video`, `process_camera`, `capture_and_process_frame`. No HTTP/FastAPI server yet. |
| **React Dashboard** | ✅ Implemented | `dashboard_service/` — Vite + React + Material UI v5. Full verification UI per spec. |
| **Employee login** | ✅ Implemented | Login page (Employee ID + password). `useAuth` hook, localStorage session. Header shows user + Logout. Demo: any ID + password `barricade123`. |
| **Frontend state machine** | ✅ Implemented | `useReducer` with RFID / ANPR / Fingerprint states per CONTEXT spec. |
| **WebSocket integration** | ✅ Implemented | `useWebSocket` hook connects to `ws://localhost:8080/ws`. When connected, "Start Verification" sends to API Agent; when offline, local "Simulate Verification". |
| **API Agent** | ✅ Implemented | `api_agent/` — FastAPI + WebSocket at `/ws`, routes: `/`, `/health`, `/ws`. Mock verification flow (RFID → ANPR → Fingerprint → gate). Commands: simulate, session_reset, manual_plate, open_gate. |
| **RFID Service** | ✅ Mock implemented | `rfid_service/` — **Push-only** to API Agent: `POST /trigger` sends `{ rfid_tag }` to `POST /rfid/scan` on the agent (no pull/list/peek APIs). `GET /ui` for local test. Hardware serial still pending. |
| **Camera feed** | ✅ Implemented | MJPEG at `http://localhost:8001/video_feed` with fallback placeholder when stream unavailable. |
| **Session log panel** | ✅ Implemented | Live append, auto-scroll. |
| **Status badges** | ✅ Implemented | RFID, ANPR, Fingerprint with full state set. |
| **RESCAN button** | ✅ Implemented | Resets session; sends `session_reset` to API Agent when connected. |
| **MANUAL PLATE ENTRY** | ✅ Implemented | Dialog + flow when ANPR needs manual input. |
| **Gate control** | ✅ Implemented | Auto-open toggle, Open Barricade button (disabled until all verified). |
| **Main entry** | ✅ Implemented | `main.py` — processes static image via ANPR. |
| **Backend service** | ✅ Implemented | Central backend in `backend-service/` — Verification, Data/Query, Alert services, PostgreSQL, Alembic. Alerts include `employee_id` when provided. |

### ❌ NOT DONE (what's left)

| Component | Status | Notes |
|-----------|--------|------|
| **ANPR HTTP server** | ❌ | FastAPI wrapper with MJPEG `/video_feed` and snapshot endpoint. |
| **RFID Service (hardware)** | ❌ | Replace mock service with real reader polling + SDK integration. |
| **Fingerprint Service** | ❌ | Python service wrapping fingerprint scanner SDK. |
| **Wire API Agent → Backend** | ⚠️ Partial | RFID ingest calls `POST /api/verify/rfid` when configured; ANPR/FP still mock / not wired. |
| **Admin panel** | ❌ | Order registration, driver/truck management. |

---

## 1. Problem Statement

At mine sites in India, cargo theft (coal, fuel, etc.) occurs through **truck-driver swapping**:
- Driver A is assigned Truck A, but brings Truck B to the site
- Driver B brings Truck A (which belongs to Driver A)
- Trucks swap license plates to avoid detection
- Drivers collude to steal goods during transit

There is currently no automated way for mine sites to verify that the correct driver and correct truck are entering together.

---

## 2. Solution Overview

A **3-factor biometric + identity verification system** installed at mine site barricade entry points.

Before any truck can enter a mine site, three things; must match a pre-registered order in the central database:

1. **RFID** — hidden tag on the truck (like FASTag), driver is unaware of it
2. **ANPR** — license plate recognition via camera (YOLOv8 + EasyOCR)
3. **Fingerprint** — driver's biometric scan

All three must be verified **in sequence** and must all match the same registered order. If any one fails, the barricade stays locked.

### System Architecture (High-Level)

```
┌─────────────────────────────────────────────────────────┐
│                    BARRICADE CLIENT                      │
│  (Local machine at each mine site entry point)           │
│                                                          │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐  │
│  │ RFID Service │   │ ANPR Service │   │ Fingerprint  │  │
│  │ (continuous  │   │ (YOLOv8 +    │   │ Service      │  │
│  │  polling)    │   │  EasyOCR)    │   │              │  │
│  └──────┬───────┘   └──────┬───────┘   └──────┬───────┘  │
│         │                  │                  │          │
│         └──────────────────┼──────────────────┘          │
│                            │                             │
│                  ┌─────────▼──────────┐                  │
│                  │   API Agent        │                  │
│                  │   (Orchestrator)   │                  │
│                  └─────────┬──────────┘                  │
│                            │                             │
│         ┌──────────────────▼───────────────────┐         │
│         │         React Dashboard              │         │
│         │  Camera | Logs | Status | Gate       │         │
│         └──────────────────────────────────────┘         │
└───────────────────────────┬─────────────────────────────┘
                            │ HTTPS / WebSocket
┌───────────────────────────▼─────────────────────────────┐
│                    CENTRAL BACKEND                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐   │
│  │ Data/Query  │  │   Alert     │  │  Verification   │   │
│  │   Service   │  │   Service   │  │    Service      │   │
│  └──────┬──────┘  └──────┬──────┘  └────────┬────────┘   │
│         └────────────────┴──────────────────┘            │
│                          │                               │
│               ┌──────────▼──────────┐                    │
│               │   Central Database  │                    │
│               │  (Orders, Trucks,   │                    │
│               │   Drivers, Logs)    │                    │
│               └─────────────────────┘                    │
└─────────────────────────────────────────────────────────┘
```

---

## 3. How It Works — End to End

### Pre-condition (before truck arrives)
- A company admin registers an **order** in the system: linking a specific truck + specific driver + mine site + drop site + goods type + scheduled date
- Truck already has RFID tag physically attached (driver doesn't know about it)
- Driver's fingerprint is already enrolled in the DB
- All master data (RFID, license plate, fingerprint, Aadhar, phone, photo) is pre-loaded

### At the barricade

**Step 1 — RFID**
- RFID service runs continuously on the local barricade PC
- When a truck arrives, RFID tag is automatically scanned
- API Agent sends RFID to backend → backend checks central DB
- **PASS:** RFID found, active order exists → auto-trigger ANPR
- **FAIL:** RFID not found OR no active order → barricade locked, alert raised, rescan available

**Step 2 — ANPR**
- Triggered automatically when RFID passes (no button press needed)
- ANPR service captures a **single snapshot** from the camera (USB or RTSP)
- YOLOv8 detects the license plate region
- EasyOCR converts plate image to text string
- API Agent sends RFID + plate to backend → backend cross-checks them against the same order
- **Retry logic:** ANPR runs up to 3 times if OCR confidence is low
- **Manual fallback:** If 3x fails, guard manually types the plate number in the dashboard
- **PASS:** Plate matches RFID record → proceed to fingerprint
- **FAIL:** Plate mismatch → barricade locked, alert raised ("possible plate swap")

**Step 3 — Fingerprint**
- Prompted only after RFID + ANPR both pass
- Dashboard shows prompt to guard: ask driver to place finger on scanner
- Fingerprint service reads biometric template from hardware
- API Agent sends RFID + plate + fingerprint to backend → backend checks all three match same order
- **PASS:** All 3 verified → gate decision
- **FAIL:** Driver mismatch → barricade locked, alert raised

**Step 4 — Gate Control**
- Backend returns PASS
- Dashboard shows green / all-clear state
- **Auto-open ON:** Barricade opens automatically
- **Auto-open OFF:** Guard manually clicks "Open Barricade" button
- Entry is logged in the central DB with timestamp, snapshot, all IDs

**Step 5 — Reset**
- After gate opens (or session is denied), all statuses reset to WAITING
- System is ready for the next truck

### Verification Flow (State Machine)

```
TRUCK ARRIVES
      │
      ▼
[RFID SCAN] ──── continuous polling ────►
      │
   match?
   NO  ──► Alert raised + barricade stays LOCKED
   YES ──►
      │
      ▼
[ANPR TRIGGERED] (auto, no button needed)
   - Capture frame → YOLOv8 plate detection → EasyOCR
   - Retry up to 3x on failure
   - Manual entry fallback if 3x fails
      │
   RFID + plate match in DB?
   NO  ──► Alert: "Plate mismatch" + LOCKED
   YES ──►
      │
      ▼
[FINGERPRINT SCAN]
   - Driver places finger on scanner
   - Send RFID + plate + fingerprint to backend
      │
   All 3 match linked order?
   NO  ──► Alert: "Driver mismatch" + LOCKED
   YES ──►
      │
      ▼
[AUTO OPEN] or [Guard clicks Open Barricade]
      │
      ▼
[LOG: entry confirmed, timestamp]
      │
      ▼
[RESET → Waiting for next truck]
```

---

## 4. System Architecture

```
BARRICADE LOCAL SYSTEM (one per entry point)
├── RFID Service          ⚠️ MOCK BUILT — push-only `POST` to API Agent `/rfid/scan`; hardware serial not built
├── ANPR Service          ⚠️ Library done, HTTP server not built
│                         Needs: FastAPI + MJPEG /video_feed
├── Fingerprint Service   ❌ NOT BUILT — Python, hardware SDK
├── API Agent             ✅ DONE — FastAPI + WebSocket (core/, routes/, services/)
└── React Dashboard       ✅ DONE — Vite + React + MUI v5, login gate, verification UI

CENTRAL BACKEND (backend-service/)
├── Verification Service  ✅ 3-factor check; accepts optional employee_id
├── Data/Query Service    ✅ Full CRUD
├── Alert Service         ✅ Auto-created on failures; stores employee_id
├── Central Database      ✅ PostgreSQL, Alembic
└── Admin Panel           ❌
```

### Communication

| From | To | Protocol | Status |
|------|----|----------|--------|
| Dashboard | API Agent | WebSocket | ✅ Connected at ws://localhost:8080/ws |
| Dashboard | ANPR Service | HTTP MJPEG | ✅ URL wired, ANPR server missing |
| API Agent | Dashboard | WebSocket | ✅ Events per spec (rfid_check_result, anpr_result, etc.) |
| RFID Service | API Agent | HTTP POST `{ rfid_tag }` → `/rfid/scan` | ✅ One-way ingest |
| API Agent | Local services (ANPR/FP) | HTTP REST | ❌ |
| API Agent | Backend | HTTPS REST | ❌ (backend ready; agent still mock)

---

## 5. Frontend State Machine (implemented)

States are in `dashboard_service/src/constants.js` and `useVerificationState.js`.

### Dashboard Layout

Login gate: employee signs in (Employee ID + password) before seeing the dashboard. Session stored in localStorage; header shows user name and Logout.

```
┌─────────────────────────────────────────────────────────────┐
│                    BARRICADE DASHBOARD                        │
│                                                              │
│  ┌─────────────────────┐    ┌─────────────────────────────┐  │
│  │  [Camera Feed]      │    │  RFID     [●SCAN / ✓ / ✗]   │  │
│  │  MJPEG stream or    │    │  ANPR     [●HOLD / ✓ / ✗]   │  │
│  │  placeholder        │    │  Finger   [●HOLD / ✓ / ✗]   │  │
│  └─────────────────────┘    └─────────────────────────────┘  │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐     │
│  │  Session Log                                         │     │
│  │  ── RFID scanned                                     │     │
│  │  ── ANPR — Plate MH12AB4821 (98%)                    │     │
│  │  ── Fingerprint verified — Amit Kumar                │     │
│  └─────────────────────────────────────────────────────┘     │
│                                                              │
│  [RESCAN]          [MANUAL PLATE ENTRY]                       │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐     │
│  │  ⛔ LOCKED  /  ✅ OPEN BARRICADE                     │     │
│  │  [Toggle: Auto-open ON/OFF]                          │     │
│  └─────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

### RFID States
| State | Meaning |
|-------|---------|
| WAITING | Default. RFID polling, no truck present |
| SCANNING | Tag detected, reading in progress |
| IN_PROGRESS | Sent to backend, awaiting result |
| VALIDATED | Found in DB, active order exists |
| FAILED | Not found or no order. Session blocked |

### ANPR States
| State | Meaning |
|-------|---------|
| ON_HOLD | Waiting for RFID to pass |
| TRIGGERED | RFID passed, capturing frame |
| PROCESSING | YOLOv8 + EasyOCR running |
| RETRY | Low confidence, recapturing |
| MANUAL_ENTRY | 3x failed, guard types plate manually |
| IN_PROGRESS | Plate + RFID sent to backend |
| VALIDATED | Plate matches RFID record |
| FAILED | Mismatch. Session blocked |

### Fingerprint States
| State | Meaning |
|-------|---------|
| ON_HOLD | Waiting for RFID + ANPR to both pass |
| WAITING_SCAN | Prompting guard to ask driver to scan |
| SCANNING | Hardware reading template |
| IN_PROGRESS | All 3 sent to backend |
| VALIDATED | All 3 match. Order confirmed |
| FAILED | Driver mismatch. Session blocked |

### WebSocket Events (API Agent → Dashboard)
```json
{ "event": "rfid_check_result", "status": "VALIDATED", "rfid": "TRK-0042", "order_id": "ORD-2024-891" }
{ "event": "anpr_result", "status": "VALIDATED", "plate": "MH04AB1234", "confidence": 0.94 }
{ "event": "anpr_retry", "attempt": 2 }
{ "event": "anpr_manual", "reason": "3x OCR failure" }
{ "event": "fingerprint_result", "status": "VALIDATED", "driver": "Ramesh Kumar", "all_clear": true }
{ "event": "gate_decision", "open": true, "method": "auto" }
{ "event": "alert_raised", "type": "plate_mismatch", "detail": "..." }
{ "event": "session_reset" }
```

---

## 6. Alert System

Backend (`backend-service/`) auto-creates alerts on verification failures. Alerts store `employee_id` (logged-in barricade employee) when provided for investigation.

| Alert Type | Trigger |
|------------|---------|
| rfid_unknown | RFID tag not found in DB |
| rfid_no_order | RFID found but no active order for today |
| plate_mismatch | RFID matched but plate belongs to a different truck |
| plate_swap_suspected | RFID matched, plate from another registered truck |
| driver_mismatch | Fingerprint doesn't match assigned driver |
| anpr_failure | ANPR failed 3x, manual entry required |

---

## 7. Database Schema

Full schema (7 tables, UUID PKs) is implemented in `backend-service/` with Alembic. Alerts table includes `employee_id` (VARCHAR 100, nullable) for the logged-in barricade employee. Summary:

### trucks
| Column | Type |
|--------|------|
| id | UUID PK |
| rfid_tag | VARCHAR UNIQUE |
| license_plate | VARCHAR UNIQUE |
| make_model | VARCHAR |
| owner_name | VARCHAR |
| registered_at | TIMESTAMP |
| is_active | BOOLEAN |

### drivers
| Column | Type |
|--------|------|
| id | UUID PK |
| full_name | VARCHAR |
| fingerprint_template | BYTEA |
| fingerprint_id | VARCHAR |
| aadhar_number | VARCHAR UNIQUE |
| phone_number | VARCHAR |
| photo_url | TEXT |
| is_active | BOOLEAN |

### orders
| Column | Type |
|--------|------|
| id | UUID PK |
| truck_id | UUID FK → trucks |
| driver_id | UUID FK → drivers |
| mine_site_id | UUID FK → sites |
| drop_site_id | UUID FK → sites |
| goods_type | VARCHAR |
| scheduled_date | DATE |
| status | ENUM |
| created_by | UUID FK |

### entry_logs, alerts, barricades, sites
See `backend-service/CONTEXT.MD` for full schema. `alerts` includes `employee_id` for investigation.

---

## 8. Build Roadmap

### Phase 1 — Core Local Services
- [x] ANPR library (YOLOv8 + EasyOCR + SORT)
- [x] React dashboard (full UI per spec)
- [x] Employee login page (useAuth, LoginPage, header user + logout)
- [x] WebSocket hook + demo mode
- [x] Camera feed (MJPEG URL + fallback)
- [x] Status panel, session log, RESCAN, manual plate entry
- [x] Gate control + auto-open toggle
- [x] **API Agent** (FastAPI + WebSocket, routes: /, /health, /ws; mock verification flow)
- [ ] **ANPR HTTP server** (FastAPI + `/video_feed` MJPEG + snapshot endpoint)
- [x] **RFID mock service** (`rfid_service/` FastAPI + mock scan queue)
- [ ] **RFID hardware service** (Python, serial/SDK)
- [ ] **Fingerprint service** (Python, hardware SDK)

### Phase 2 — Backend & Verification
- [x] Backend (in `backend-service/`): PostgreSQL schema + Alembic, CRUD, Verification Service, Alert Service, seed data
- [x] Alert employee tracking (dashboard sends `employee_id`; backend stores on alerts)
- [ ] Wire API Agent → Backend (pass `employee_id` in verify requests)
- [ ] End-to-end: RFID → ANPR → Fingerprint → response

### Phase 3 — Integration & Polish
- [x] Connect real WebSocket (API Agent) — dashboard uses it when online
- [ ] Connect real MJPEG stream (ANPR server)
- [ ] ANPR 3x retry logic in ANPR service
- [ ] Remove demo mode or keep as fallback

### Phase 4 — Alerts & Hardening
- [ ] Alert Service
- [ ] Alert display on dashboard
- [ ] Snapshot storage on every ANPR capture
- [ ] Offline resilience
- [ ] Error handling for hardware failures

### Phase 5 — Admin & Multi-site
- [ ] Admin panel (order registration, driver/truck management)
- [ ] Multi-barricade support
- [ ] Audit log & reporting
- [ ] SMS/push alerts to supervisor

---

## 9. Tech Stack

| Layer | Technology |
|-------|------------|
| ANPR | Python, YOLOv8, EasyOCR, OpenCV (library done; FastAPI server TBD) |
| RFID Service | Python, pyserial / vendor SDK |
| Fingerprint Service | Python, hardware scanner SDK |
| API Agent | Python, FastAPI, websockets |
| React Dashboard | React 19, Vite, Material UI v5, WebSocket |
| Backend | Python, FastAPI (in `backend-service/`) |
| Database | PostgreSQL 16 |

---

## 10. Key Design Decisions

1. **RFID triggers ANPR automatically** — no scan button. RFID always polling; once it fires, ANPR triggers.
2. **Snapshot, not stream** — ANPR captures a single frame when triggered. MJPEG stream is for preview only.
3. **API Agent as event bus** — Dashboard receives all events via WebSocket.
4. **Guard cannot override** — Open Barricade disabled until all 3 factors validate.
5. **3x ANPR retry + manual fallback** — If OCR fails 3x, guard enters plate manually.
6. **Demo mode** — When API Agent is unreachable, "Simulate Verification" runs a mock flow for UI testing.
7. **Employee login** — Dashboard is gated; guards sign in with Employee ID + password (session in localStorage). Header shows user and Logout.
8. **Alert employee tracking** — Dashboard sends logged-in `employee_id` with Start Verification; backend stores it on alerts when verification fails (investigation/accountability).

---

## 11. Project Structure

```
barricade-service/
├── anpr_service/           ✅ ANPR Python library
│   ├── anpr_service.py
│   ├── utility.py
│   ├── sort/
│   └── examples/
├── api_agent/              ✅ FastAPI + WebSocket orchestrator
│   ├── core/               events.py, connection.py
│   ├── routes/             root.py, health.py, ws.py
│   ├── services/           verification.py (mock flow)
│   ├── app.py
│   ├── main.py
│   └── pyproject.toml
├── rfid_service/           ✅ Mock RFID service (push-only)
│   ├── app.py              `GET /ui`, `POST /trigger` → httpx POST to API Agent
│   ├── push.py             `push_rfid_tag` → `{ rfid_tag }` only
│   ├── service.py          In-memory tag cycle (mock hardware)
│   ├── mock_data.py        Tag strings list
│   ├── config.py           `API_AGENT_RFID_INGEST_URL`
│   ├── main.py             uvicorn entry point (port 8002)
│   └── pyproject.toml
├── dashboard_service/      ✅ React dashboard
│   └── src/
│       ├── components/     Header, CameraFeed, SessionLog, StatusBadge,
│       │                   GateControl, ManualPlateEntryDialog, LoginPage
│       ├── hooks/          useVerificationState, useWebSocket, useAuth
│       ├── constants.js
│       └── App.jsx
├── main.py                 ✅ Entry point (processes static image)
├── pyproject.toml
├── yolov8n.pt
└── CONTEXT.MD              (this file)
```

---

## 12. Open Questions

- RFID hardware: specific reader model and library
- Fingerprint hardware: scanner model and SDK
- Snapshot storage: local filesystem vs S3
- Admin panel auth: roles (admin / supervisor / viewer)
- Offline mode: queue events when backend unreachable?
