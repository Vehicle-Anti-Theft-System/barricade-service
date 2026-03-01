import { useRef, useEffect } from "react";
import { Button } from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";

export function SessionLog({ logs, sessionPhase, onRescan, isRescanning }) {
  const logsRef = useRef(null);

  useEffect(() => {
    if (logsRef.current) {
      logsRef.current.scrollTop = logsRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="card white-card logs-card">
      <div className="logs-header">
        <h3>Timestamp — Log</h3>
        <div className="logs-actions">
          <Button
            variant="contained"
            size="small"
            startIcon={<RefreshIcon />}
            onClick={onRescan}
            disabled={isRescanning}
            sx={{
              textTransform: "uppercase",
              fontWeight: 700,
              fontSize: "0.72rem",
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
              <th>Time</th>
              <th>Event Description</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 && (
              <tr>
                <td colSpan="3" className="logs-empty">
                  Awaiting verification scan…
                </td>
              </tr>
            )}
            {logs.map((log, i) => (
              <tr key={i} className={`log-row log-${log.status}`}>
                <td>{log.time}</td>
                <td>{log.event}</td>
                <td>
                  <span
                    className={`status-tag ${log.status === "error" ? "status-error" : ""}`}
                  >
                    {log.status === "error" ? "✕ Failed" : "✓ Validated"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
