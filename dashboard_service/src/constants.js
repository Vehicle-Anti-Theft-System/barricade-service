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

export const MJPEG_STREAM_URL = "http://localhost:8001/video_feed";
export const WEBSOCKET_URL = "ws://localhost:8080/ws";
