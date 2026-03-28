import { Button, Switch, FormControlLabel } from "@mui/material";
import LockIcon from "@mui/icons-material/Lock";
import LockOpenIcon from "@mui/icons-material/LockOpen";
import { RFID_STATES, ANPR_STATES } from "../constants";

export function GateControl({
  rfid,
  anpr,
  autoOpen,
  onAutoOpenChange,
  gateOpen,
  gateAnim,
  onOpenGate,
}) {
  const allVerified =
    rfid?.status === RFID_STATES.VALIDATED &&
    anpr?.status === ANPR_STATES.VALIDATED;

  const isOpen = gateOpen;
  /** Manual open when both factors passed and gate not yet opened this session (auto toggle does not affect this). */
  const canManualOpen = allVerified && !gateOpen;

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
          label="License Plate (ANPR)"
          checked={anpr?.status === ANPR_STATES.VALIDATED}
          scanning={[
            ANPR_STATES.TRIGGERED,
            ANPR_STATES.PROCESSING,
            ANPR_STATES.RETRY,
            ANPR_STATES.MANUAL_ENTRY,
            ANPR_STATES.IN_PROGRESS,
          ].includes(anpr?.status)}
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
          label="Open gate automatically after verification"
          sx={{
            margin: 0,
            alignItems: "flex-start",
            "& .MuiFormControlLabel-label": {
              fontSize: "0.8rem",
              fontWeight: 500,
              color: "text.secondary",
              lineHeight: 1.35,
            },
          }}
        />
      </div>

      <Button
        fullWidth
        variant="contained"
        size="large"
        onClick={() => canManualOpen && onOpenGate()}
        disabled={!canManualOpen}
        startIcon={isOpen ? <LockOpenIcon /> : <LockIcon />}
        className={`btn-primary ${gateAnim ? "gate-pop" : ""} ${!canManualOpen ? "btn-disabled" : ""}`}
        sx={{
          textTransform: "none",
          fontWeight: 700,
          fontSize: "0.875rem",
          letterSpacing: "0.02em",
          py: 1.5,
          backgroundColor: (theme) =>
            isOpen ? theme.palette.success.main : theme.palette.primary.main,
          "&:hover": {
            backgroundColor: (theme) =>
              isOpen ? theme.palette.success.dark : theme.palette.primary.dark,
          },
          "&.Mui-disabled": {
            backgroundColor: (theme) => theme.palette.action.disabledBackground,
            color: (theme) => theme.palette.action.disabled,
          },
        }}
      >
        {isOpen ? "Gate open" : "Open barricade"}
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
