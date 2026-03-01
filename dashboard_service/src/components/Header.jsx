import { IconButton } from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import { RFID_STATES } from "../constants";

export function Header({ wsConnected, onSimulateDemo }) {
  return (
    <div className="header">
      <IconButton size="small" sx={{ color: "white" }}>
        <MenuIcon />
      </IconButton>
      <div className="header-center">
        <span className={`status-dot ${wsConnected ? "online" : "offline"}`} />
        Status: <strong>{wsConnected ? "ONLINE" : "DEMO"}</strong>
        <span className="header-divider">|</span>
        Checkpoint: North Gate
        {!wsConnected && onSimulateDemo && (
          <button
            className="simulate-btn"
            onClick={onSimulateDemo}
            type="button"
            title="Simulate RFID scan (demo mode)"
          >
            Simulate Verification
          </button>
        )}
      </div>
      <IconButton size="small" sx={{ color: "white" }}>
        <PersonOutlineIcon />
      </IconButton>
    </div>
  );
}
