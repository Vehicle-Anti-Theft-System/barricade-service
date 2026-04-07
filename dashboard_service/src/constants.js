/**
 * Verification state constants per CONTEXT.MD
 * Frontend State Machine — 2-factor: RFID + ANPR only
 */

export const RFID_STATES = {
  WAITING: "WAITING",
  SCANNING: "SCANNING",
  IN_PROGRESS: "IN_PROGRESS",
  VALIDATED: "VALIDATED",
  FAILED: "FAILED",
};

export const ANPR_STATES = {
  ON_HOLD: "ON_HOLD",
  TRIGGERED: "TRIGGERED",
  PROCESSING: "PROCESSING",
  RETRY: "RETRY",
  MANUAL_ENTRY: "MANUAL_ENTRY",
  IN_PROGRESS: "IN_PROGRESS",
  VALIDATED: "VALIDATED",
  FAILED: "FAILED",
};

const API_AGENT_HOST = import.meta.env.VITE_API_AGENT_HOST || "localhost:8080";
const ANPR_HOST = import.meta.env.VITE_ANPR_HOST || "localhost:8001";

/** Central backend for JWT login and admin API (optional — mock login if unset). */
export const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || "").replace(/\/$/, "");

export const MJPEG_STREAM_URL = `http://${ANPR_HOST}/video_feed`;
export const WEBSOCKET_URL = `ws://${API_AGENT_HOST}/ws`;
