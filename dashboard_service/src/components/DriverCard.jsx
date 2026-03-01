import { FINGERPRINT_STATES } from "../constants";
import PersonIcon from "@mui/icons-material/Person";
import FingerprintIcon from "@mui/icons-material/Fingerprint";

export function DriverCard({ fingerprint }) {
  const status = fingerprint?.status ?? FINGERPRINT_STATES.ON_HOLD;
  const isValidated = status === FINGERPRINT_STATES.VALIDATED;
  const isScanning = [
    FINGERPRINT_STATES.WAITING_SCAN,
    FINGERPRINT_STATES.SCANNING,
    FINGERPRINT_STATES.IN_PROGRESS,
  ].includes(status);

  return (
    <div className="card white-card info-card driver-card">
      <div className="info-card-header">
        <span className="info-icon">
          <PersonIcon sx={{ fontSize: 18 }} />
        </span>
        <span className="info-card-title">DRIVER</span>
        {isValidated && <span className="check-badge">✓</span>}
        {isScanning && <span className="scanning-dot" />}
      </div>

      {status === FINGERPRINT_STATES.ON_HOLD && (
        <p className="info-empty">Awaiting fingerprint scan</p>
      )}
      {isScanning && (
        <p className="info-scanning">Scanning fingerprint…</p>
      )}
      {isValidated && (
        <div className="driver-body">
          <div className="driver-photo">
            <PersonIcon sx={{ fontSize: 32, color: "#94a3b8" }} />
          </div>
          <div className="driver-details">
            <div className="driver-name">{fingerprint?.driver}</div>
            <div className="driver-id">{fingerprint?.driverId}</div>
            <span className="fingerprint-badge">
              <FingerprintIcon sx={{ fontSize: 14 }} /> Fingerprint Verified
              <span className="fp-tick">✓</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
