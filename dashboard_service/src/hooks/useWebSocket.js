import { useEffect, useRef, useCallback } from "react";
import { WEBSOCKET_URL } from "../constants";
import { logger } from "../utils/logger";

/**
 * WebSocket hook - connects to API Agent and dispatches events to reducer.
 * Falls back to demo mode when connection fails (no API Agent running).
 */
export function useWebSocket(dispatch, options = {}) {
  const { onConnect, onDisconnect, enableDemoMode = true } = options;
  const wsRef = useRef(null);
  const demoModeRef = useRef(false);
  const dispatchRef = useRef(dispatch);
  dispatchRef.current = dispatch;

  const simulateDemoFlow = useCallback((scenario = "success") => {
    if (!enableDemoMode || !dispatchRef.current) return;
    demoModeRef.current = true;
    logger.info("Demo flow started:", scenario);

    const d = dispatchRef.current;
    d({ type: "session_reset", payload: {} });

    if (scenario === "rfid_mismatch") {
      setTimeout(() => {
        d({
          type: "rfid_scanning",
          payload: {},
        });
      }, 300);

      setTimeout(() => {
        d({
          type: "rfid_check_result",
          payload: {
            status: "FAILED",
            rfid: "TRK-9999",
            alert_type: "rfid_unknown",
            detail: "RFID tag not found in database",
          },
        });
      }, 1400);

      return;
    }

    if (scenario === "anpr_mismatch") {
      setTimeout(() => {
        d({
          type: "rfid_scanning",
          payload: {},
        });
      }, 300);
      setTimeout(() => {
        d({
          type: "rfid_check_result",
          payload: {
            status: "VALIDATED",
            rfid: "8829-4471-001",
            truck_id: "TRK-047",
            order_id: "ORD-2024-891",
            driver_name: "Amit Kumar",
          },
        });
      }, 1300);
      setTimeout(() => {
        d({
          type: "anpr_processing",
          payload: {},
        });
      }, 1850);
      setTimeout(() => {
        d({
          type: "anpr_result",
          payload: {
            status: "FAILED",
            plate: "JH01CD5678",
            expected_plate: "MH12AB4821",
            alert_type: "plate_mismatch",
            detail: "Expected MH12AB4821, detected JH01CD5678",
          },
        });
      }, 3000);

      return;
    }

    // Success: RFID → ANPR → session complete (2-factor)
    setTimeout(() => {
      d({
        type: "rfid_scanning",
        payload: {},
      });
    }, 300);
    setTimeout(() => {
      d({
        type: "rfid_check_result",
        payload: {
          status: "VALIDATED",
          rfid: "8829-4471-001",
          truck_id: "TRK-047",
          order_id: "ORD-2024-891",
          driver_name: "Amit Kumar",
        },
      });
    }, 1500);

    setTimeout(() => {
      d({
        type: "anpr_processing",
        payload: {},
      });
    }, 2000);
    setTimeout(() => {
      d({
        type: "anpr_result",
        payload: {
          status: "VALIDATED",
          plate: "MH12AB4821",
          confidence: 0.98,
        },
      });
    }, 3500);
  }, [enableDemoMode]);

  useEffect(() => {
    let mounted = true;

    const connect = () => {
      try {
        logger.info("WebSocket connecting:", WEBSOCKET_URL);
        const ws = new WebSocket(WEBSOCKET_URL);
        wsRef.current = ws;

        ws.onopen = () => {
          if (mounted) {
            demoModeRef.current = false;
            logger.info("WebSocket connected");
            onConnect?.();
          }
        };

        ws.onmessage = (e) => {
          try {
            const msg = JSON.parse(e.data);
            logger.debug("WS event:", msg.event);
            if (mounted && dispatchRef.current) {
              dispatchRef.current({ type: msg.event, payload: msg });
            }
          } catch {
            logger.warn("WS: ignored non-JSON message");
          }
        };

        ws.onclose = () => {
          logger.info("WebSocket closed");
          if (mounted) onDisconnect?.();
        };

        ws.onerror = () => {
          logger.warn("WebSocket error; closing socket");
          ws.close();
        };
      } catch (err) {
        logger.error("WebSocket connect failed:", err);
        if (mounted && enableDemoMode) {
          onDisconnect?.();
        }
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
  }, [enableDemoMode, onConnect, onDisconnect]);

  return {
    isDemoMode: demoModeRef.current,
    simulateDemoFlow,
    send: (data) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        const payload = typeof data === "string" ? data : JSON.stringify(data);
        const label =
          typeof data === "object" && data !== null ? data.event || data.command || "message" : "raw";
        logger.debug("WS send:", label);
        wsRef.current.send(payload);
      } else {
        logger.warn("WS send skipped: socket not open");
      }
    },
  };
}
