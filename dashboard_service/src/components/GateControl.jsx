import { Button, Switch, FormControlLabel } from "@mui/material";
import LockIcon from "@mui/icons-material/Lock";
import LockOpenIcon from "@mui/icons-material/LockOpen";
import {
  RFID_STATES,
  ANPR_STATES,
  FINGERPRINT_STATES,
} from "../constants";

export function GateControl({
  rfid,
  anpr,
  fingerprint,
  autoOpen,
  onAutoOpenChange,
  gateOpen,
  gateAnim,
  onOpenGate,
}) {
  const allVerified =
    rfid?.status === RFID_STATES.VALIDATED &&
    anpr?.status === ANPR_STATES.VALIDATED &&
    fingerprint?.status === FINGERPRINT_STATES.VALIDATED;

  const isOpen = gateOpen;
  const canOpen = allVerified;

  return (
    <div className="card gate-card">
      <div className="gate-checks">
        <CheckRow
          label="RFID"
          checked={rfid?.status === RFID_STATES.VALIDATED}
          scanning={[
            RFID_STATES.SCANNING,
            RFID_STATES.IN_PROGRESS,
          ].includes(rfid?.status)}
        />
        <CheckRow
          label="License Plate"
          checked={anpr?.status === ANPR_STATES.VALIDATED}
          scanning={[
            ANPR_STATES.TRIGGERED,
            ANPR_STATES.PROCESSING,
            ANPR_STATES.RETRY,
            ANPR_STATES.IN_PROGRESS,
          ].includes(anpr?.status)}
        />
        <CheckRow
          label="Driver Verification"
          checked={fingerprint?.status === FINGERPRINT_STATES.VALIDATED}
          scanning={[
            FINGERPRINT_STATES.WAITING_SCAN,
            FINGERPRINT_STATES.SCANNING,
            FINGERPRINT_STATES.IN_PROGRESS,
          ].includes(fingerprint?.status)}
        />
      </div>

      <div className="gate-auto-row">
        <FormControlLabel
          control={
            <Switch
              checked={autoOpen}
              onChange={(e) => onAutoOpenChange(e.target.checked)}
              color="success"
              size="small"
            />
          }
          label="Open Automatically"
          sx={{
            "& .MuiFormControlLabel-label": {
              fontSize: "0.78rem",
              color: "#94a3b8",
            },
          }}
        />
      </div>

      <Button
        fullWidth
        variant="contained"
        size="large"
        onClick={() => canOpen && onOpenGate()}
        disabled={!canOpen}
        startIcon={isOpen ? <LockOpenIcon /> : <LockIcon />}
        className={`btn-primary ${gateAnim ? "gate-pop" : ""} ${!canOpen ? "btn-disabled" : ""}`}
        sx={{
          textTransform: "uppercase",
          fontWeight: 700,
          fontSize: "0.82rem",
          py: 1.5,
          backgroundColor: isOpen ? "#22c55e" : "#3b82f6",
          "&:hover": {
            backgroundColor: isOpen ? "#16a34a" : "#2563eb",
          },
          "&.Mui-disabled": {
            backgroundColor: "#475569",
            color: "rgba(255,255,255,0.7)",
          },
        }}
      >
        {isOpen ? "✅ Gate Open" : "⛔ Open Barricade"}
      </Button>
    </div>
  );
}

function CheckRow({ label, checked, scanning }) {
  return (
    <div className="check-row">
      <span
        className={`check-circle ${checked ? "checked" : scanning ? "pulsing" : "empty"}`}
      >
        {checked ? "✓" : scanning ? "…" : "○"}
      </span>
      <span>{label}</span>
    </div>
  );
}
