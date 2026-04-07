import { useRef, useEffect, useMemo } from "react";
import { Button, Chip } from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";

function sessionStatusLabel(phase) {
  switch (phase) {
    case "running":
      return "In progress";
    case "complete":
      return "Complete";
    case "error":
      return "Failed";
    default:
      return "Awaiting start";
  }
}

/** Legacy entries used `{ status: 'success' | 'error' }` only. */
function normalizeLogEntry(log) {
  if (log.variant && log.label != null) {
    return { time: log.time, event: log.event, variant: log.variant, label: log.label };
  }
  const isErr = log.status === "error";
  return {
    time: log.time,
    event: log.event,
    variant: isErr ? "error" : "success",
    label: isErr ? "Failed" : "Completed",
  };
}

function statusChipColor(variant) {
  switch (variant) {
    case "success":
      return "success";
    case "error":
      return "error";
    case "warning":
      return "warning";
    case "info":
      return "info";
    default:
      return "default";
  }
}

export function SessionLog({ logs, sessionPhase, onRescan, isRescanning }) {
  const logsRef = useRef(null);

  const rows = useMemo(() => logs.map(normalizeLogEntry), [logs]);

  useEffect(() => {
    if (logsRef.current) {
      logsRef.current.scrollTop = logsRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="card white-card logs-card">
      <div className="logs-header">
        <div className="logs-title-block">
          <h3>Activity</h3>
          <p className="logs-phase">{sessionStatusLabel(sessionPhase)}</p>
        </div>
        <div className="logs-actions">
          <Button
            variant="outlined"
            color="primary"
            size="small"
            startIcon={<RefreshIcon />}
            onClick={onRescan}
            disabled={isRescanning}
            sx={{
              textTransform: "none",
              fontWeight: 600,
              fontSize: "0.8125rem",
              borderRadius: "8px",
            }}
          >
            {isRescanning ? "Resetting…" : "Rescan"}
          </Button>
        </div>
      </div>
      <div className="logs-table-wrapper" ref={logsRef}>
        <table className="logs-table">
          <thead>
            <tr>
              <th className="logs-col-time">Time</th>
              <th>Event</th>
              <th className="logs-col-outcome">Outcome</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan="3" className="logs-empty">
                  No events yet. Scan an RFID tag to begin verification.
                </td>
              </tr>
            )}
            {rows.map((log, i) => (
              <tr
                key={`${log.time}-${i}`}
                className={`log-row log-row--${log.variant}`}
              >
                <td className="log-time">{log.time}</td>
                <td className="log-event">{log.event}</td>
                <td className="log-outcome-cell">
                  <Chip
                    label={log.label}
                    size="small"
                    variant="outlined"
                    color={statusChipColor(log.variant)}
                    sx={{
                      height: 24,
                      maxWidth: "100%",
                      fontWeight: 600,
                      fontSize: "0.6875rem",
                      letterSpacing: "0.01em",
                      borderRadius: "6px",
                      "& .MuiChip-label": {
                        px: 1,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      },
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
