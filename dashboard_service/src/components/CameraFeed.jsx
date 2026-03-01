import { useState } from "react";
import { MJPEG_STREAM_URL } from "../constants";
import { ANPR_STATES } from "../constants";

const FALLBACK_IMAGE =
  "https://plus.unsplash.com/premium_photo-1664695368767-c42483a0bda1?fm=jpg&q=60&w=3000&auto=format&fit=crop&ixlib=rb-4.1.0";

export function CameraFeed({ anpr, sessionPhase }) {
  const [streamError, setStreamError] = useState(false);
  const useFallback = streamError;

  const isProcessing =
    anpr.status === ANPR_STATES.TRIGGERED ||
    anpr.status === ANPR_STATES.PROCESSING ||
    anpr.status === ANPR_STATES.RETRY;

  return (
    <div className="card camera-card">
      <div className="vehicle-box">
        <img
          src={useFallback ? FALLBACK_IMAGE : MJPEG_STREAM_URL}
          alt="Live feed"
          onError={() => setStreamError(true)}
        />
        <div className="cam-label">
          Camera 1 — {useFallback ? "Placeholder" : "Live"}
        </div>

        {anpr.status === ANPR_STATES.VALIDATED && (
          <div className="detection-overlay">
            <span className="detection-label">
              Plate Detected {Math.round((anpr.confidence ?? 0) * 100)}%
            </span>
          </div>
        )}
        {isProcessing && (
          <div className="scanning-overlay">
            <span className="pulse-ring" />
            <span className="scan-text">Scanning plate…</span>
          </div>
        )}

        {sessionPhase === "complete" && (
          <div className="phase-banner success">✓ VERIFICATION COMPLETE</div>
        )}
        {sessionPhase === "error" && (
          <div className="phase-banner error">
            ✕ VERIFICATION FAILED — ALERT RAISED
          </div>
        )}
      </div>
    </div>
  );
}
