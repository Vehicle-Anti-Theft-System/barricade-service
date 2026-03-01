import { useEffect, useRef, useCallback } from "react";
import { WEBSOCKET_URL } from "../constants";

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

  const simulateDemoFlow = useCallback(() => {
    if (!enableDemoMode || !dispatchRef.current) return;
    demoModeRef.current = true;

    const d = dispatchRef.current;
    // Simulate RFID scan
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
        },
      });
    }, 1500);

    // Simulate ANPR
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

    // Simulate fingerprint
    setTimeout(() => {
      d({
        type: "fingerprint_scanning",
        payload: {},
      });
    }, 4000);
    setTimeout(() => {
      d({
        type: "fingerprint_result",
        payload: {
          status: "VALIDATED",
          driver: "Amit Kumar",
          driver_id: "D101121",
          fingerprint_id: "FP-88291",
          all_clear: true,
        },
      });
    }, 5500);
  }, [enableDemoMode]);

  useEffect(() => {
    let mounted = true;

    const connect = () => {
      try {
        const ws = new WebSocket(WEBSOCKET_URL);
        wsRef.current = ws;

        ws.onopen = () => {
          if (mounted) {
            demoModeRef.current = false;
            onConnect?.();
          }
        };

        ws.onmessage = (e) => {
          try {
            const msg = JSON.parse(e.data);
            if (mounted && dispatchRef.current) {
              dispatchRef.current({ type: msg.event, payload: msg });
            }
          } catch {
            // ignore
          }
        };

        ws.onclose = () => {
          if (mounted) onDisconnect?.();
        };

        ws.onerror = () => {
          ws.close();
        };
      } catch {
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
        wsRef.current.send(typeof data === "string" ? data : JSON.stringify(data));
      }
    },
  };
}
