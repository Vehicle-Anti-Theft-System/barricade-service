# Barricade Dashboard (React + Vite)

Operator and **admin** UI for the mine-site barricade edge. Talks to the **API Agent** over **WebSocket** and optionally to the **central backend** over **HTTPS** for JWT login and **`/admin`** CRUD.

**Detail:** [`CONTEXT.MD`](CONTEXT.MD) · **Whole project:** [`../../backend-service/project_context.md`](../../backend-service/project_context.md)

---

## Prerequisites

- **Node.js** + **npm** (see parent `barricade-service` install via `./bin/setup`)

---

## Install

From **`dashboard_service/`**:

```bash
npm install
```

Or from **`barricade-service/`** root: **`./bin/setup`** (includes `npm install` here).

---

## Environment (Vite)

Copy from parent **`.env.example`** or set in **`barricade-service/.env`** (loaded when running via `run-barricade.sh`). Only **`VITE_*`** variables are exposed to the browser.

| Variable | Example | Purpose |
|----------|---------|---------|
| **`VITE_API_AGENT_HOST`** | `localhost:8080` | WebSocket: `ws://…/ws` |
| **`VITE_ANPR_HOST`** | `localhost:8001` | MJPEG: `http://…/video_feed` |
| **`VITE_BACKEND_URL`** | `http://localhost:8000` | **No trailing slash.** JWT login + admin API. Omit for offline demo login |

---

## Run

**With the full edge stack** (recommended):

```bash
cd ..   # barricade-service/
./run-barricade.sh
```

Dashboard defaults to **http://localhost:5173**.

- **`npm run dev`** — Vite **`--mode agent`** (production-style gate UI: `AppAgent.jsx`).
- **`npm run dev:demo`** — default Vite mode (`App.jsx` demo).

---

## App entrypoints

| File | Mode |
|------|------|
| **`AppAgent.jsx`** | Live gate: WebSocket to API Agent, JWT when `VITE_BACKEND_URL` is set |
| **`App.jsx`** | Demo: simulation cases, mock auth when no backend URL |

`main.jsx` selects the app based on Vite **mode**.

---

## Features (summary)

- **Gate:** RFID / ANPR status, camera preview, activity log, **Open barricade**, **Rescan** (session reset + `session_reset` to agent), **Open automatically** toggle, manual plate entry.
- **Admin (`/admin`):** Orders, trucks, drivers, configuration, alerts — **JWT** required; **viewer** read-only; **admin** full access + alerts tab.
- **Header:** API Agent connection + **Server** (central backend) via WebSocket **`backend_health`** from the agent (browser does not poll `:8000` for liveness).

---

## Stack

- **React 19**, **Vite**
- **Material UI** (`@mui/material` — see `package.json` for version)
- **react-router-dom**

---

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Dev server, **agent** mode (`AppAgent.jsx`) |
| `npm run dev:demo` | Dev server, demo app (`App.jsx`) |
| `npm run build` / `npm run build:agent` | Production builds |
| `npm run preview` | Preview production build |
| `npm run lint` | ESLint |
