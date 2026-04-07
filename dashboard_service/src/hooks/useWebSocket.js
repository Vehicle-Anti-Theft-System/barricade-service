import { useEffect, useRef } from "react";
import { WEBSOCKET_URL } from "../constants";
import { logger } from "../utils/logger";

/**
 * WebSocket hook — connects to API Agent and dispatches events to reducer.
 * Live verification is driven by RFID → agent; no client-side mock flows.
 */
export function useWebSocket(dispatch, options = {}) {
  const { onConnect, onDisconnect, onBackendHealth } = options;
  const wsRef = useRef(null);
  const dispatchRef = useRef(dispatch);
  dispatchRef.current = dispatch;

  const onConnectRef = useRef(onConnect);
  const onDisconnectRef = useRef(onDisconnect);
  const onBackendHealthRef = useRef(onBackendHealth);
  onConnectRef.current = onConnect;
  onDisconnectRef.current = onDisconnect;
  onBackendHealthRef.current = onBackendHealth;

  useEffect(() => {
    let mounted = true;

    const connect = () => {
      try {
        logger.info("WebSocket connecting:", WEBSOCKET_URL);
        const ws = new WebSocket(WEBSOCKET_URL);
        wsRef.current = ws;

        ws.onopen = () => {
          if (mounted) {
            logger.info("WebSocket connected");
            onConnectRef.current?.();
          }
        };

        ws.onmessage = (e) => {
          try {
            const msg = JSON.parse(e.data);
            logger.debug("WS event:", msg.event);
            if (msg.event === "backend_health") {
              const fn = onBackendHealthRef.current;
              if (mounted && typeof fn === "function") {
                fn(msg.connected === true);
              }
              return;
            }
            if (mounted && dispatchRef.current) {
              dispatchRef.current({ type: msg.event, payload: msg });
            }
          } catch {
            logger.warn("WS: ignored non-JSON message");
          }
        };

        ws.onclose = () => {
          logger.info("WebSocket closed");
          if (mounted) onDisconnectRef.current?.();
        };

        ws.onerror = () => {
          logger.warn("WebSocket error; closing socket");
          ws.close();
        };
      } catch (err) {
        logger.error("WebSocket connect failed:", err);
        if (mounted) onDisconnectRef.current?.();
      }
    };

    connect();

    return () => {
      mounted = false;
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  return {
    send: (data) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        const payload = typeof data === "string" ? data : JSON.stringify(data);
        const label =
          typeof data === "object" && data !== null ? data.event || data.command || "message" : "raw";
        logger.debug("WS send:", label);
        wsRef.current.send(payload);
        return true;
      }
      logger.warn("WS send skipped: socket not open");
      return false;
    },
  };
}
