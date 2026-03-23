import PersonIcon from "@mui/icons-material/Person";
import { RFID_STATES } from "../constants";

/** Shows order-assigned driver from RFID validation (no separate biometric step). */
export function DriverCard({ rfid }) {
  const validated = rfid?.status === RFID_STATES.VALIDATED;
  const name = rfid?.driverName;

  return (
    <div className="card white-card info-card driver-card">
      <div className="info-card-header">
        <span className="info-icon">
          <PersonIcon sx={{ fontSize: 18 }} />
        </span>
        <span className="info-card-title">ASSIGNED DRIVER</span>
        {validated && name && <span className="check-badge">✓</span>}
      </div>

      {!validated && (
        <p className="info-empty">Shown after RFID matches an active order</p>
      )}
      {validated && !name && (
        <p className="info-scanning">Driver name loading…</p>
      )}
      {validated && name && (
        <div className="driver-body">
          <div className="driver-photo">
            <PersonIcon sx={{ fontSize: 32, color: "#94a3b8", width: "100%", height: "100%" }} />
          </div>
          <div className="driver-details">
            <div className="driver-name">{name}</div>
            {rfid?.truckId && (
              <div className="driver-id">Truck: {rfid.truckId}</div>
            )}
            <span className="driver-assigned-badge">
              From order / RFID
              <span className="fp-tick">✓</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
