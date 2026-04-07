import { useState, useEffect } from "react";
import { BACKEND_URL } from "../constants";

/**
 * State for the header "Server" (central backend) indicator.
 *
 * When `VITE_BACKEND_URL` is set, the API Agent polls `BACKEND_BASE_URL/health/live`
 * and pushes `backend_health` over WebSocket — pass `setBackendConnected` to
 * `useWebSocket({ onBackendHealth })`.
 *
 * When no backend URL is configured (demo login), the server line stays "Online".
 */
export function useBackendHealthState() {
  const [backendConnected, setBackendConnected] = useState(true);

  useEffect(() => {
    if (!BACKEND_URL) {
      setBackendConnected(true);
    }
  }, []);

  return { backendConnected, setBackendConnected };
}
