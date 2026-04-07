import { useReducer } from "react";
import { RFID_STATES, ANPR_STATES } from "../constants";

const initialState = {
  rfid: {
    status: RFID_STATES.WAITING,
    value: null,
    truckId: null,
    orderId: null,
    driverName: null,
  },
  anpr: {
    status: ANPR_STATES.ON_HOLD,
    value: null,
    confidence: null,
    attempt: 0,
  },
  logs: [],
  gateOpen: false,
  /** Last open path: auto (WS/effect), manual (button / open_gate), or null when closed. */
  gateOpenMethod: null,
  gateAnim: false,
  alert: null,
  sessionPhase: "idle", // idle | running | complete | error
  /** User toggle: block automatic gate_decision (WebSocket "auto"); manual opens always apply. */
  autoOpenEnabled: true,
};

const MAX_LOGS = 50;

/** @param {{ variant: 'success' | 'error' | 'warning' | 'info'; label: string }} meta */
function pushLog(logs, time, event, meta) {
  const next = [...logs, { time, event, variant: meta.variant, label: meta.label }];
  return next.length <= MAX_LOGS ? next : next.slice(-MAX_LOGS);
}

function nowTime() {
  return new Date().toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function verificationReducer(state, action) {
  const t = nowTime();

  switch (action.type) {
    case "session_reset":
      return {
        ...initialState,
        logs:
          state.logs.length > MAX_LOGS ? state.logs.slice(-MAX_LOGS) : state.logs,
        autoOpenEnabled: state.autoOpenEnabled,
      };

    case "set_auto_open":
      /** Do not change gateOpen here — toggling "Open automatically" must not reset the gate
       *  (would re-enable Open barricade without a new verification / Rescan). */
      return {
        ...state,
        autoOpenEnabled: Boolean(action.payload?.enabled),
      };

    case "rfid_check_result":
      if (action.payload.status === "VALIDATED") {
        return {
          ...state,
          rfid: {
            status: RFID_STATES.VALIDATED,
            value: action.payload.rfid,
            truckId: action.payload.truck_id,
            orderId: action.payload.order_id,
            driverName:
              action.payload.driver_name ?? action.payload.driverName ?? null,
          },
          anpr: {
            ...state.anpr,
            status: ANPR_STATES.TRIGGERED,
          },
          sessionPhase: "running",
          logs: pushLog(state.logs, t, `RFID Scanned — Truck ${action.payload.truck_id}`, {
            variant: "success",
            label: "RFID verified",
          }),
        };
      }
      return {
        ...state,
        rfid: {
          status: RFID_STATES.FAILED,
          value: action.payload.rfid ?? null,
          truckId: null,
          orderId: null,
          driverName: null,
        },
        sessionPhase: "error",
        alert: action.payload.detail ?? "RFID not found or no active order",
        logs: pushLog(state.logs, t, `RFID FAILED — ${action.payload.detail ?? "Not found"}`, {
          variant: "error",
          label: "RFID rejected",
        }),
      };

    case "anpr_result":
      if (action.payload.status === "VALIDATED") {
        return {
          ...state,
          anpr: {
            status: ANPR_STATES.VALIDATED,
            value: action.payload.plate,
            confidence: action.payload.confidence,
          },
          /** New verification cycle completed — gate must not stay open from a stale client session. */
          gateOpen: false,
          gateOpenMethod: null,
          sessionPhase: "complete",
          logs: pushLog(
            state.logs,
            t,
            `ANPR — Plate ${action.payload.plate} (${Math.round((action.payload.confidence ?? 0) * 100)}%) — verification complete`,
            { variant: "success", label: "Plate verified" }
          ),
        };
      }
      return {
        ...state,
        anpr: {
          ...state.anpr,
          status: ANPR_STATES.FAILED,
        },
        sessionPhase: "error",
        alert: action.payload.detail ?? "Plate mismatch",
        logs: pushLog(state.logs, t, `ANPR FAILED — ${action.payload.detail ?? "Plate mismatch"}`, {
          variant: "error",
          label: "Plate rejected",
        }),
      };

    case "anpr_retry":
      return {
        ...state,
        anpr: {
          ...state.anpr,
          status: ANPR_STATES.RETRY,
          attempt: action.payload.attempt ?? state.anpr.attempt + 1,
        },
        sessionPhase: "running",
        logs: pushLog(
          state.logs,
          t,
          `ANPR Retry — attempt ${action.payload.attempt ?? state.anpr.attempt + 1}`,
          { variant: "warning", label: "OCR retry" }
        ),
      };

    case "anpr_manual":
      return {
        ...state,
        anpr: {
          ...state.anpr,
          status: ANPR_STATES.MANUAL_ENTRY,
        },
        sessionPhase: "running",
        logs: pushLog(state.logs, t, `ANPR — Manual entry required (3x OCR failure)`, {
          variant: "warning",
          label: "Review required",
        }),
      };

    case "anpr_manual_submit":
      return {
        ...state,
        anpr: {
          status: ANPR_STATES.VALIDATED,
          value: action.payload.plate,
          confidence: 1,
        },
        gateOpen: false,
        gateOpenMethod: null,
        sessionPhase: "complete",
        logs: pushLog(
          state.logs,
          t,
          `Manual plate entry — ${action.payload.plate} — verification complete`,
          { variant: "success", label: "Plate verified" }
        ),
      };

    case "gate_decision": {
      const wantOpen = action.payload.open ?? true;
      const method = action.payload.method ?? "auto";
      if (wantOpen && method !== "manual" && !state.autoOpenEnabled) {
        return state;
      }
      return {
        ...state,
        gateOpen: wantOpen,
        gateOpenMethod: wantOpen ? method : null,
        gateAnim: true,
        logs: pushLog(
          state.logs,
          t,
          `Gate ${wantOpen ? "Opened" : "Stay locked"} — ${method}`,
          {
            variant: wantOpen ? "success" : "info",
            label: wantOpen ? "Gate opened" : "Gate held",
          }
        ),
      };
    }

    case "alert_raised":
      return {
        ...state,
        alert: action.payload.detail ?? action.payload.type,
        logs: pushLog(
          state.logs,
          t,
          `Alert — ${action.payload.type}: ${action.payload.detail ?? ""}`,
          { variant: "error", label: "Alert" }
        ),
      };

    case "gate_open_click":
      return {
        ...state,
        gateOpen: true,
        gateOpenMethod: "manual",
        gateAnim: true,
      };

    case "gate_anim_done":
      return { ...state, gateAnim: false };

    case "rfid_scanning":
      return {
        ...state,
        rfid: { ...state.rfid, status: RFID_STATES.SCANNING },
        sessionPhase: "running",
      };

    case "rfid_in_progress":
      return {
        ...state,
        rfid: { ...state.rfid, status: RFID_STATES.IN_PROGRESS },
        sessionPhase: "running",
      };

    case "anpr_processing":
      return {
        ...state,
        anpr: { ...state.anpr, status: ANPR_STATES.PROCESSING },
        sessionPhase: "running",
      };

    default:
      return state;
  }
}

export function useVerificationState() {
  return useReducer(verificationReducer, initialState);
}
