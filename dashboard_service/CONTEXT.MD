# Barricade Dashboard (`dashboard_service/`)

**Last updated:** 2026-04-08  

**Purpose:** Single source of truth for the **React (Vite) operator UI** that ships inside `barricade-service/`. It is **not** the central API (that is `backend-service/`).

---

## How to read this document

| Section | Contents |
|---------|----------|
| **Quick reference** | Builds, ports, env vars at a glance |
| **Where it sits** | ASCII diagram: browser ↔ agent ↔ backend |
| **Authentication** | JWT vs demo mode |
| **Data flow** | REST + WebSocket paths |
| **Gate UI** | Screen areas and behavior |
| **Admin UI** | Routes and RBAC |
| **Hooks** | Responsibility table |
| **Key files** | Folder map |

**Related docs:**

| Path | Topic |
|------|--------|
| `../CONTEXT.MD` | Full barricade edge (ANPR, RFID, API Agent) |
| `../api_agent/CONTEXT.MD` | API Agent detail |
| `../../backend-service/CONTEXT.MD` | Central FastAPI + MongoDB |
| `../../backend-service/context_old.md` | **Full system** narrative |

---

## Quick reference

| Item | Value / note |
|------|----------------|
| **Framework** | React 19, Vite, **Material UI v5** (`@mui/material`) |
| **Routing** | `react-router-dom` — `/` gate, `/admin/*` admin shell |
| **Agent build** | `AppAgent.jsx` — live WebSocket + optional JWT |
| **Demo build** | `App.jsx` — mock auth, simulation cases, offline timers |
| **Typical dev port** | `5173` (Vite) |

### Build modes

| Mode | Entry | When to use |
|------|--------|-------------|
| **Agent / production** | `AppAgent.jsx` | `npm run dev -- --mode agent` or project script | Real gate: WS to API Agent, JWT when `VITE_BACKEND_URL` set |
| **Demo** | `App.jsx` | Default dev without agent mode | Mock login, optional offline flows |

---

## System position (browser in the stack)

```
  ┌─────────────────────────────────────────────────────────────────────────┐
  │                         BROWSER (this SPA)                               │
  │                                                                          │
  │   Gate UI (/)              Admin UI (/admin/*)                           │
  │   ─────────────            ───────────────────                           │
  │   WebSocket  ───────────►  API Agent :8080  (/ws)                        │
  │   MJPEG      ───────────►  ANPR :8001       (/video_feed)               │
  │                                                                          │
  │   REST (JWT) ───────────►  backend-service :8000                         │
  │       POST /api/auth/login                                               │
  │       GET  /api/orders, /api/trucks, …                                   │
  │                                                                          │
  │   Note: "Server" (central backend) liveness is NOT polled from here.   │
  │   API Agent polls BACKEND/health/live and pushes backend_health on WS.  │
  └─────────────────────────────────────────────────────────────────────────┘
```

---

## Environment variables (Vite)

Only variables prefixed with **`VITE_`** are exposed to the browser.

| Variable | Example | Role |
|----------|---------|------|
| `VITE_API_AGENT_HOST` | `localhost:8080` | Builds `ws://…/ws` for **`useWebSocket`** |
| `VITE_ANPR_HOST` | `localhost:8001` | MJPEG URL `http://…/video_feed` for **`CameraFeed`** |
| `VITE_BACKEND_URL` | `http://localhost:8000` | **No trailing slash.** Enables real **JWT login** and admin **REST** (`/api/…`). If **unset**, demo login path (employee id + shared password style) without JWT to central API |

**Alignment:** `BACKEND_BASE_URL` in the **API Agent** `.env` and `VITE_BACKEND_URL` here should point at the **same** logical central API in normal deployments (different env names: Python vs Vite).

---

## Authentication (`src/hooks/useAuth.js`)

```
  VITE_BACKEND_URL set?
         │
         ├── YES ──► POST {VITE_BACKEND_URL}/api/auth/login
         │           Body: { username, password }
         │           (username matches stored user **email** — avoids strict
         │            browser validation on .local domains)
         │           Stores access_token + user in localStorage (barricade_auth)
         │
         └── NO  ──► Legacy mock user (no JWT to backend)
```

| Concern | Behavior |
|---------|----------|
| **Token expiry** | JWT `exp` read client-side; timer in `utils/jwtExpiry.js` |
| **401 from API** | `apiFetch` clears storage, dispatches `barricade:session-expired` |
| **Session reset** | `useAuth` listens and resets UI auth state |

---

## API calls (`src/hooks/useBackendApi.js`)

| Aspect | Detail |
|--------|--------|
| **Transport** | `fetch` wrapper **`apiFetch`** adds `Authorization: Bearer <token>` |
| **Base URL** | `VITE_BACKEND_URL` |
| **401** | Clears auth + event as above |

---

## WebSocket (`src/hooks/useWebSocket.js`)

| Item | Detail |
|------|--------|
| **URL** | From `constants.js`: `ws://{VITE_API_AGENT_HOST}/ws` |
| **Verification** | Events feed **`useVerificationState`** reducer: `rfid_scanning`, `rfid_check_result`, `anpr_*`, `gate_decision`, `session_reset`, … |
| **`backend_health`** | **Separate path:** `{ event: "backend_health", connected: boolean }`. Drives **Server** line in header (central backend up/down). **Source of truth:** API Agent polls `BACKEND_BASE_URL/health/live` and pushes over WS — the **browser does not** call `:8000` for liveness |

---

## Backend health hook (`src/hooks/useBackendHealth.js`)

| Role | Detail |
|------|--------|
| **Purpose** | Holds React state for “central backend connected” driven by WS |
| **Setter** | Called when `backend_health` messages arrive |
| **Consumer** | **`Header`** shows API Agent line + Server (backend) line |

---

## Gate UI (`AppAgent.jsx` + `components/`)

### Screen layout (conceptual)

```
  ┌──────────────────────────────────────────────────────────────────────┐
  │ Header: Dashboard (WS) │ Server (backend via WS) │ Checkpoint │ User │
  │        [hamburger → drawer: admin links if JWT + role]    [Log out]   │
  ├──────────────────────────────────────────────────────────────────────┤
  │  Camera (MJPEG)              │  Session / verification panel         │
  │  ANPR preview                │  Activity log, states, messages       │
  ├──────────────────────────────┴──────────────────────────────────────┤
  │ Gate control: Auto-open toggle, manual plate, Open Barricade, Rescan │
  └──────────────────────────────────────────────────────────────────────┘
```

| Area | Behavior |
|------|----------|
| **Header — Dashboard** | WebSocket connectivity to API Agent |
| **Header — Server** | Backend liveness via **`backend_health`** only |
| **Camera** | MJPEG stream from ANPR service |
| **Session log** | Reducer-driven; copy avoids exposing **expected** plate strings on failures (backend strings are privacy-aware) |
| **Gate control** | Auto-open toggle, manual plate dialog, open barricade; commands go **over WebSocket** to agent |

---

## Admin UI (`src/admin/`)

Base path: **`/admin`**. Requires **JWT** and role **`admin`** or **`viewer`**.

### Route map

```
  /admin
    ├── /orders          Orders list (truck plate, driver name, …)
    ├── /trucks          Trucks; RFID column **admin-only**
    ├── /drivers         Drivers CRUD (per RBAC)
    ├── /configuration   Edge-oriented settings (camera mode, RFID serial);
    │                    ingest URL not shown in UI
    └── /alerts          **Admin only** — `GET /api/alerts/`
```

### RBAC matrix (UI)

| Role | Read lists | Create/update/delete | Alerts tab |
|------|------------|-------------------------|------------|
| **viewer** | Yes | No | Hidden |
| **admin** | Yes | Yes | Yes |

---

## Hooks — responsibility summary

| Hook | Responsibility |
|------|----------------|
| `useAuth` | Login, token storage, expiry, session-expired events |
| `useWebSocket` | Connect to agent, dispatch verification + `backend_health` |
| `useBackendHealth` | State for central backend “connected” from WS |
| `useBackendApi` | Authenticated CRUD to central API |
| `useVerificationState` | RFID/ANPR/gate reducer, activity log (max 50 FIFO), `autoOpenEnabled` |

---

## Key files

```
dashboard_service/src/
├── main.jsx                 # BrowserRouter; App vs AppAgent by Vite mode
├── App.jsx                  # Demo: simulation, offline flows
├── AppAgent.jsx             # Production gate + routes
├── constants.js             # WEBSOCKET_URL, BACKEND_URL, MJPEG_STREAM_URL
├── components/              # Header, CameraFeed, SessionLog, GateControl, …
├── admin/                   # AdminLayout, OrdersPage, TrucksPage, DriversPage,
│                            # ConfigurationPage, AlertsPage
├── hooks/
│   ├── useAuth.js
│   ├── useWebSocket.js
│   ├── useBackendApi.js
│   ├── useBackendHealth.js
│   └── useVerificationState.js
└── utils/jwtExpiry.js
```

---

## Tech stack

| Piece | Technology |
|-------|------------|
| UI | React 19, Material UI v5 |
| Build | Vite |
| Routing | react-router-dom |
| Realtime | Native WebSocket to API Agent |

---

## Design notes (short)

1. **Two “backends” in the UI copy:** **API Agent** (orchestration, WS) vs **central backend** (MongoDB, verify APIs). Header labels disambiguate.
2. **No browser poll to `:8000` for liveness** — avoids CORS noise and duplicates agent’s health check.
3. **Admin RFID column** — hidden from viewers to reduce sensitive tag exposure in shared screens.
