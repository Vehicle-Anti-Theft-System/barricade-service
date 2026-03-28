#!/usr/bin/env bash
# Start the four barricade edge services:
#   1. api_agent      (port 8080 — WebSocket + HTTP)
#   2. anpr_service   (port 8001 — camera / plate detection)
#   3. rfid_service   (port 8002 — mock RFID → API Agent)
#   4. dashboard_service (port 5173 — Vite dev server)
#
# The central backend is not started here; set BACKEND_BASE_URL in .env (e.g. AWS API).
#
# Prerequisites: uv, Node/npm; copy .env.example → .env
#
# Optional: SKIP_ANPR=1  SKIP_DASHBOARD=1

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DASH_DIR="${ROOT}/dashboard_service"

PIDS=()

load_env() {
  local f="$1"
  if [[ -f "$f" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$f"
    set +a
    echo "[run-barricade] Loaded $f"
  fi
}

cleanup() {
  echo ""
  echo "[run-barricade] Stopping services..."
  for pid in "${PIDS[@]}"; do
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
    fi
  done
  wait 2>/dev/null || true
  echo "[run-barricade] Done."
}

trap cleanup EXIT

load_env "${ROOT}/.env"

if [[ -z "${BACKEND_BASE_URL:-}" ]]; then
  echo "[run-barricade] WARNING: BACKEND_BASE_URL is unset — set it in ${ROOT}/.env"
fi
if [[ -z "${DEFAULT_BARRICADE_ID:-}" ]]; then
  echo "[run-barricade] WARNING: DEFAULT_BARRICADE_ID is unset — set it in ${ROOT}/.env"
fi

echo "[run-barricade] Starting api_agent, anpr_service, rfid_service, dashboard_service"
echo ""

# 1 — API Agent first (RFID and dashboard connect here)
echo "[run-barricade] api_agent (8080)..."
(cd "$ROOT" && uv run api-agent) &
PIDS+=($!)
sleep 1

# 2 — ANPR
if [[ "${SKIP_ANPR:-0}" != "1" ]]; then
  echo "[run-barricade] anpr_service (8001)..."
  (cd "$ROOT" && uv run anpr-service) &
  PIDS+=($!)
  sleep 1
fi

# 3 — RFID (no --reload: single process, clean shutdown)
echo "[run-barricade] rfid_service (8002)..."
(cd "$ROOT" && uv run uvicorn rfid_service.app:app --host 0.0.0.0 --port 8002) &
PIDS+=($!)

# 4 — Dashboard
if [[ "${SKIP_DASHBOARD:-0}" != "1" ]]; then
  if [[ ! -d "$DASH_DIR/node_modules" ]]; then
    echo "[run-barricade] dashboard_service: npm install..."
    (cd "$DASH_DIR" && npm install)
  fi
  echo "[run-barricade] dashboard_service (5173)..."
  (cd "$DASH_DIR" && npm run dev) &
  PIDS+=($!)
fi

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  Running:"
echo "    • api_agent           http://localhost:8080  ws://localhost:8080/ws"
[[ "${SKIP_ANPR:-0}" != "1" ]] && echo "    • anpr_service        http://localhost:8001/health"
echo "    • rfid_service        http://localhost:8002/ui"
[[ "${SKIP_DASHBOARD:-0}" != "1" ]] && echo "    • dashboard_service   http://localhost:5173"
[[ -n "${BACKEND_BASE_URL:-}" ]] && echo ""
[[ -n "${BACKEND_BASE_URL:-}" ]] && echo "  BACKEND_BASE_URL (API Agent →): ${BACKEND_BASE_URL}"
echo ""
echo "  Ctrl+C — stop all."
echo "═══════════════════════════════════════════════════════════"
echo ""

wait || true
