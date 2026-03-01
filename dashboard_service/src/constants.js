/**
 * Verification state constants per CONTEXT.MD
 * Frontend State Machine - Section 7
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

export const FINGERPRINT_STATES = {
  ON_HOLD: "ON_HOLD",
  WAITING_SCAN: "WAITING_SCAN",
  SCANNING: "SCANNING",
  IN_PROGRESS: "IN_PROGRESS",
  VALIDATED: "VALIDATED",
  FAILED: "FAILED",
};

export const MJPEG_STREAM_URL = "http://localhost:8001/video_feed";
export const WEBSOCKET_URL = "ws://localhost:8080/ws";
