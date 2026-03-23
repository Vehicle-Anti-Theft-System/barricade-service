import {
  Box,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";

export function Header({
  wsConnected,
  onStartVerification,
  simulateCase,
  onSimulateCaseChange,
  showSimulationControls = true,
  startDisabled = false,
  offlineStatusLabel = "DEMO",
  user,
  onLogout,
}) {
  const initials = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase()
    : "?";

  return (
    <div className="header">
      <IconButton size="small" sx={{ color: "white" }}>
        <MenuIcon />
      </IconButton>
      <div className="header-center">
        <span className={`status-dot ${wsConnected ? "online" : "offline"}`} />
        Status: <strong>{wsConnected ? "ONLINE" : offlineStatusLabel}</strong>
        <span className="header-divider">|</span>
        Checkpoint: {user?.checkpoint || "North Gate"}
        {onStartVerification && (
          <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1.25, ml: 1 }}>
            {showSimulationControls && (
              <FormControl
                size="small"
                sx={{
                  minWidth: 190,
                  "& .MuiInputLabel-root": { color: "rgba(255,255,255,0.75)" },
                  "& .MuiInputLabel-root.Mui-focused": { color: "rgba(255,255,255,0.9)" },
                  "& .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.35)" },
                  "& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline": {
                    borderColor: "rgba(255,255,255,0.55)",
                  },
                  "& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline": {
                    borderColor: "rgba(255,255,255,0.85)",
                  },
                  "& .MuiSelect-select": { color: "white", py: 0.75 },
                  "& .MuiSvgIcon-root": { color: "white" },
                }}
              >
                <InputLabel id="simulate-case-label">Simulation Case</InputLabel>
                <Select
                  labelId="simulate-case-label"
                  id="simulate-case"
                  value={simulateCase}
                  label="Simulation Case"
                  onChange={(e) => onSimulateCaseChange?.(e.target.value)}
                >
                  <MenuItem value="success">Success</MenuItem>
                  <MenuItem value="rfid_mismatch">RFID mismatch</MenuItem>
                  <MenuItem value="anpr_mismatch">ANPR mismatch</MenuItem>
                </Select>
              </FormControl>
            )}
            <button
              className="simulate-btn"
              onClick={onStartVerification}
              disabled={startDisabled}
              type="button"
              title={
                wsConnected
                  ? "Start verification (API Agent)"
                  : showSimulationControls
                    ? "Simulate verification (demo)"
                    : "API Agent is offline"
              }
            >
              {wsConnected ? "Start Verification" : showSimulationControls ? "Simulate Verification" : "Start Verification"}
            </button>
          </Box>
        )}
      </div>
      <div className="user-info">
        <div className="user-avatar">{initials}</div>
        <span>{user?.name || "Guard"}</span>
        {onLogout && (
          <button className="logout-btn" onClick={onLogout} type="button">
            Logout
          </button>
        )}
      </div>
    </div>
  );
}
