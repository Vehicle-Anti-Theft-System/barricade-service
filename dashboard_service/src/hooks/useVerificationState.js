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
  gateAnim: false,
  alert: null,
  sessionPhase: "idle", // idle | running | complete | error
};

function pushLog(logs, time, event, status) {
  return [...logs, { time, event, status }];
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
        logs: state.logs,
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
          logs: pushLog(
            state.logs,
            t,
            `RFID Scanned — Truck ${action.payload.truck_id}`,
            "success"
          ),
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
        logs: pushLog(
          state.logs,
          t,
          `RFID FAILED — ${action.payload.detail ?? "Not found"}`,
          "error"
        ),
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
          sessionPhase: "complete",
          logs: pushLog(
            state.logs,
            t,
            `ANPR — Plate ${action.payload.plate} (${Math.round((action.payload.confidence ?? 0) * 100)}%) — verification complete`,
            "success"
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
        logs: pushLog(
          state.logs,
          t,
          `ANPR FAILED — ${action.payload.detail ?? "Plate mismatch"}`,
          "error"
        ),
      };

    case "anpr_retry":
      return {
        ...state,
        anpr: {
          ...state.anpr,
          status: ANPR_STATES.RETRY,
          attempt: action.payload.attempt ?? state.anpr.attempt + 1,
        },
        logs: pushLog(
          state.logs,
          t,
          `ANPR Retry — attempt ${action.payload.attempt ?? state.anpr.attempt + 1}`,
          "success"
        ),
      };

    case "anpr_manual":
      return {
        ...state,
        anpr: {
          ...state.anpr,
          status: ANPR_STATES.MANUAL_ENTRY,
        },
        logs: pushLog(
          state.logs,
          t,
          `ANPR — Manual entry required (3x OCR failure)`,
          "success"
        ),
      };

    case "anpr_manual_submit":
      return {
        ...state,
        anpr: {
          status: ANPR_STATES.VALIDATED,
          value: action.payload.plate,
          confidence: 1,
        },
        sessionPhase: "complete",
        logs: pushLog(
          state.logs,
          t,
          `Manual plate entry — ${action.payload.plate} — verification complete`,
          "success"
        ),
      };

    case "gate_decision":
      return {
        ...state,
        gateOpen: action.payload.open ?? true,
        gateAnim: true,
        logs: pushLog(
          state.logs,
          t,
          `Gate ${action.payload.open ? "Opened" : "Stay locked"} — ${action.payload.method ?? "manual"}`,
          "success"
        ),
      };

    case "alert_raised":
      return {
        ...state,
        alert: action.payload.detail ?? action.payload.type,
        logs: pushLog(
          state.logs,
          t,
          `Alert — ${action.payload.type}: ${action.payload.detail ?? ""}`,
          "error"
        ),
      };

    case "gate_open_click":
      return {
        ...state,
        gateOpen: true,
        gateAnim: true,
      };

    case "gate_anim_done":
      return { ...state, gateAnim: false };

    case "rfid_scanning":
      return {
        ...state,
        rfid: { ...state.rfid, status: RFID_STATES.SCANNING },
      };

    case "rfid_in_progress":
      return {
        ...state,
        rfid: { ...state.rfid, status: RFID_STATES.IN_PROGRESS },
      };

    case "anpr_processing":
      return {
        ...state,
        anpr: { ...state.anpr, status: ANPR_STATES.PROCESSING },
      };

    default:
      return state;
  }
}

export function useVerificationState() {
  return useReducer(verificationReducer, initialState);
}
