import {
  RFID_STATES,
  ANPR_STATES,
  FINGERPRINT_STATES,
} from "../constants";
import WifiIcon from "@mui/icons-material/Wifi";
import DirectionsCarIcon from "@mui/icons-material/DirectionsCar";
import FingerprintIcon from "@mui/icons-material/Fingerprint";

const STATUS_LABELS = {
  [RFID_STATES.WAITING]: "Awaiting RFID scan",
  [RFID_STATES.SCANNING]: "Reading RFID tag…",
  [RFID_STATES.IN_PROGRESS]: "Checking backend…",
  [RFID_STATES.VALIDATED]: "Validated",
  [RFID_STATES.FAILED]: "Failed",

  [ANPR_STATES.ON_HOLD]: "On hold",
  [ANPR_STATES.TRIGGERED]: "Capturing…",
  [ANPR_STATES.PROCESSING]: "Running YOLOv8 ANPR…",
  [ANPR_STATES.RETRY]: "Retrying…",
  [ANPR_STATES.MANUAL_ENTRY]: "Manual entry required",
  [ANPR_STATES.IN_PROGRESS]: "Checking backend…",
  [ANPR_STATES.VALIDATED]: "Validated",
  [ANPR_STATES.FAILED]: "Failed",

  [FINGERPRINT_STATES.ON_HOLD]: "On hold",
  [FINGERPRINT_STATES.WAITING_SCAN]: "Awaiting fingerprint scan",
  [FINGERPRINT_STATES.SCANNING]: "Scanning fingerprint…",
  [FINGERPRINT_STATES.IN_PROGRESS]: "Checking backend…",
  [FINGERPRINT_STATES.VALIDATED]: "Validated",
  [FINGERPRINT_STATES.FAILED]: "Failed",
};

function getStatusKind(status, type) {
  const validated =
    type === "rfid"
      ? RFID_STATES.VALIDATED
      : type === "anpr"
        ? ANPR_STATES.VALIDATED
        : FINGERPRINT_STATES.VALIDATED;
  const failed =
    type === "rfid"
      ? RFID_STATES.FAILED
      : type === "anpr"
        ? ANPR_STATES.FAILED
        : FINGERPRINT_STATES.FAILED;

  if (status === validated) return "validated";
  if (status === failed) return "failed";
  const busy = [
    RFID_STATES.SCANNING,
    RFID_STATES.IN_PROGRESS,
    ANPR_STATES.TRIGGERED,
    ANPR_STATES.PROCESSING,
    ANPR_STATES.RETRY,
    ANPR_STATES.IN_PROGRESS,
    FINGERPRINT_STATES.WAITING_SCAN,
    FINGERPRINT_STATES.SCANNING,
    FINGERPRINT_STATES.IN_PROGRESS,
  ];
  if (busy.includes(status)) return "scanning";
  return "waiting";
}

const IconMap = {
  rfid: WifiIcon,
  anpr: DirectionsCarIcon,
  fingerprint: FingerprintIcon,
};

export function StatusBadge({ type, data }) {
  const Icon = IconMap[type];
  const status = data?.status ?? (type === "rfid" ? RFID_STATES.WAITING : type === "anpr" ? ANPR_STATES.ON_HOLD : FINGERPRINT_STATES.ON_HOLD);
  const kind = getStatusKind(status, type);
  const label = STATUS_LABELS[status] ?? status;

  return (
    <div className="card white-card info-card status-badge">
      <div className="info-card-header">
        <span className="info-icon">
          <Icon sx={{ fontSize: 18 }} />
        </span>
        <span className="info-card-title">
          {type === "rfid" ? "RFID" : type === "anpr" ? "LICENSE PLATE" : "FINGERPRINT"}
        </span>
        {kind === "validated" && <span className="check-badge">✓</span>}
        {kind === "failed" && <span className="fail-badge">✗</span>}
        {kind === "scanning" && <span className="scanning-dot" />}
      </div>
      {kind === "waiting" && <p className="info-empty">{label}</p>}
      {kind === "scanning" && <p className="info-scanning">{label}</p>}
      {kind === "validated" && (
        <>
          <div className="info-card-value">
            {type === "rfid" && data?.value}
            {type === "anpr" && data?.value}
            {type === "fingerprint" && data?.driver}
          </div>
          <div className="info-card-sub">
            {type === "rfid" && data?.truckId && `Truck: ${data.truckId}`}
            {type === "anpr" &&
              data?.confidence != null &&
              `Confidence: ${Math.round(data.confidence * 100)}%`}
            {type === "fingerprint" && data?.driverId}
          </div>
        </>
      )}
      {kind === "failed" && (
        <p className="info-error">{label}</p>
      )}
    </div>
  );
}
