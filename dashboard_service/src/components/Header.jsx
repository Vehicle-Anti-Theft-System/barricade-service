import { IconButton } from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";

export function Header({ wsConnected, onStartVerification, user, onLogout }) {
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
        Status: <strong>{wsConnected ? "ONLINE" : "DEMO"}</strong>
        <span className="header-divider">|</span>
        Checkpoint: {user?.checkpoint || "North Gate"}
        {onStartVerification && (
          <button
            className="simulate-btn"
            onClick={onStartVerification}
            type="button"
            title={wsConnected ? "Start verification (API Agent)" : "Simulate verification (demo)"}
          >
            {wsConnected ? "Start Verification" : "Simulate Verification"}
          </button>
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
