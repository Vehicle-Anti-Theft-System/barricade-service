import { useState, useEffect, useRef } from "react";
import "./App.css";

/* ─────────────────────────────────────────────
   MOCK API  —  replace these with real fetch()
   calls to your FastAPI endpoints
────────────────────────────────────────────── */
const API = {
  scanRFID: () =>
    new Promise((res) =>
      setTimeout(
        () => res({ ok: true, rfid: "8829-4471-001", truck_id: "TRK-047" }),
        2000
      )
    ),

  captureANPR: () =>
    new Promise((res) =>
      setTimeout(
        () => res({ ok: true, plate: "MH-12 AB-4821", confidence: 98 }),
        2500
      )
    ),

  scanFingerprint: () =>
    new Promise((res) =>
      setTimeout(
        () =>
          res({
            ok: true,
            driver_name: "Amit Kumar",
            driver_id: "D101121",
            fingerprint_id: "FP-88291",
          }),
        2000
      )
    ),

  validateAssignment: (payload) =>
    new Promise((res) =>
      setTimeout(
        () => res({ ok: true, assignment_id: "ASN-2024-309", gate: "open" }),
        1500
      )
    ),

  getLogs: () =>
    new Promise((res) =>
      setTimeout(
        () =>
          res([
            { time: "02:05:51 PM", event: "RFID Scan Checkpoint North", status: "success" },
            { time: "02:06:04 PM", event: "License Plate MH-12 AB-4821", status: "success" },
            { time: "02:06:18 PM", event: "Driver Biometric Verified", status: "success" },
            { time: "02:06:31 PM", event: "Assignment Relation Validated", status: "success" },
            { time: "02:07:02 PM", event: "Gate Open Signal Sent", status: "success" },
            { time: "02:07:45 PM", event: "Vehicle Entry Logged to Cloud", status: "success" },
          ]),
        500
      )
    ),
};

/* ─── STATUS CONSTANTS ─── */
const S = { IDLE: "idle", SCANNING: "scanning", DONE: "done", ERROR: "error" };

/* ─────────────────────────────────────────────
   MAIN APP
────────────────────────────────────────────── */
export default function App() {
  /* Verification states — all data from backend */
  const [rfid, setRfid] = useState({ status: S.IDLE, value: null, truckId: null });
  const [anpr, setAnpr] = useState({ status: S.IDLE, value: null, confidence: null });
  const [fp,   setFp  ] = useState({ status: S.IDLE, name: null, driverId: null });
  const [assign, setAssign] = useState({ status: S.IDLE });
  const [logs,  setLogs ] = useState([]);
  const [phase, setPhase] = useState("idle"); // idle | running | complete | error

  /* Frontend-only controls */
  const [autoOpen,  setAutoOpen ] = useState(true);
  const [gateOpen,  setGateOpen ] = useState(false);
  const [gateAnim,  setGateAnim ] = useState(false);

  const logsRef = useRef(null);

  /* Auto-scroll logs */
  useEffect(() => {
    if (logsRef.current)
      logsRef.current.scrollTop = logsRef.current.scrollHeight;
  }, [logs]);

  /* ── Sequential verification pipeline ── */
  async function runVerification() {
    if (phase === "running") return;
    setPhase("running");
    setGateOpen(false);
    setRfid({ status: S.IDLE, value: null, truckId: null });
    setAnpr({ status: S.IDLE, value: null, confidence: null });
    setFp(  { status: S.IDLE, name: null, driverId: null });
    setAssign({ status: S.IDLE });
    setLogs([]);

    try {
      /* 1. RFID */
      setRfid((p) => ({ ...p, status: S.SCANNING }));
      const rfidRes = await API.scanRFID();
      if (!rfidRes.ok) throw new Error("RFID not found in database");
      setRfid({ status: S.DONE, value: rfidRes.rfid, truckId: rfidRes.truck_id });
      pushLog("02:05:51 PM", `RFID Scanned — Truck ${rfidRes.truck_id}`, "success");

      /* 2. ANPR */
      setAnpr((p) => ({ ...p, status: S.SCANNING }));
      const anprRes = await API.captureANPR();
      if (!anprRes.ok) throw new Error("Plate not recognised");
      setAnpr({ status: S.DONE, value: anprRes.plate, confidence: anprRes.confidence });
      pushLog("02:06:04 PM", `ANPR — Plate ${anprRes.plate} (${anprRes.confidence}%)`, "success");

      /* 3. Fingerprint */
      setFp((p) => ({ ...p, status: S.SCANNING }));
      const fpRes = await API.scanFingerprint();
      if (!fpRes.ok) throw new Error("Fingerprint mismatch");
      setFp({ status: S.DONE, name: fpRes.driver_name, driverId: fpRes.driver_id });
      pushLog("02:06:18 PM", `Driver Biometric — ${fpRes.driver_name} (${fpRes.driver_id})`, "success");

      /* 4. Assignment cross-check */
      setAssign({ status: S.SCANNING });
      const aRes = await API.validateAssignment({
        rfid: rfidRes.rfid, plate: anprRes.plate, fp_id: fpRes.fingerprint_id,
      });
      if (!aRes.ok) throw new Error("Assignment relation invalid");
      setAssign({ status: S.DONE });
      pushLog("02:06:31 PM", `Assignment ${aRes.assignment_id} Validated`, "success");

      /* 5. Fetch full logs from server */
      const serverLogs = await API.getLogs();
      setLogs(serverLogs);

      /* 6. Gate */
      setPhase("complete");
      if (autoOpen && aRes.gate === "open") openGate();

    } catch (err) {
      pushLog(nowTime(), `ERROR — ${err.message}`, "error");
      setPhase("error");
    }
  }

  function pushLog(time, event, status) {
    setLogs((prev) => [...prev, { time, event, status }]);
  }

  function openGate() {
    setGateOpen(true);
    setGateAnim(true);
    setTimeout(() => setGateAnim(false), 600);
  }

  function nowTime() {
    return new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }

  const allVerified = rfid.status === S.DONE && anpr.status === S.DONE && fp.status === S.DONE && assign.status === S.DONE;

  return (
    <div className="screen">
      <div className="main-container">

        {/* ── HEADER ── */}
        <div className="header">
          <button className="icon-btn"><HamburgerIcon /></button>
          <div className="header-center">
            <span className="online-dot"></span>
            Status: <strong>ONLINE</strong>
            <span className="header-divider">|</span>
            Checkpoint: North Gate
          </div>
          <button className="icon-btn avatar-btn"><AvatarIcon /></button>
        </div>

        {/* ── GRID ── */}
        <div className="content">

          {/* LEFT */}
          <div className="left">
            <div className="card camera-card">
              <div className="vehicle-box">
                <img
                  src="https://plus.unsplash.com/premium_photo-1664695368767-c42483a0bda1?fm=jpg&q=60&w=3000&auto=format&fit=crop&ixlib=rb-4.1.0"
                  alt="Live feed"
                />
                <div className="cam-label">Camera 1 — Live</div>

                {/* ANPR overlay — shown when ANPR is done */}
                {anpr.status === S.DONE && (
                  <div className="detection-overlay">
                    <span className="detection-label">
                      Plate Detected {anpr.confidence}%
                    </span>
                  </div>
                )}
                {anpr.status === S.SCANNING && (
                  <div className="scanning-overlay">
                    <span className="pulse-ring"></span>
                    <span className="scan-text">Scanning plate…</span>
                  </div>
                )}

                {/* Phase banner */}
                {phase === "complete" && (
                  <div className="phase-banner success">✓ VERIFICATION COMPLETE</div>
                )}
                {phase === "error" && (
                  <div className="phase-banner error">✕ VERIFICATION FAILED — ALERT RAISED</div>
                )}
              </div>
            </div>

            {/* Logs */}
            <div className="card white-card logs-card">
              <div className="logs-header">
                <h3>Timestamp — Log</h3>
                <button
                  className={`scan-btn ${phase === "running" ? "scanning" : ""}`}
                  onClick={runVerification}
                  disabled={phase === "running"}
                >
                  {phase === "running" ? "Verifying…" : phase === "complete" || phase === "error" ? "Re-scan" : "Start Verification"}
                </button>
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
                          <span className={`status-tag ${log.status === "error" ? "status-error" : ""}`}>
                            {log.status === "error" ? "✕ Failed" : "✓ Validated"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* RIGHT */}
          <div className="right">

            {/* RFID */}
            <InfoCard
              icon={<WifiIcon />}
              title="RFID"
              status={rfid.status}
              value={rfid.status === S.DONE ? rfid.value : null}
              subvalue={rfid.truckId ? `Truck: ${rfid.truckId}` : null}
              scanLabel="Reading RFID tag…"
              emptyLabel="Awaiting RFID scan"
            />

            {/* LICENSE PLATE */}
            <InfoCard
              icon={<PlateIcon />}
              title="LICENSE PLATE"
              status={anpr.status}
              value={anpr.status === S.DONE ? anpr.plate || anpr.value : null}
              subvalue={anpr.confidence ? `Confidence: ${anpr.confidence}%` : null}
              scanLabel="Running YOLOv8 ANPR…"
              emptyLabel="Awaiting camera capture"
            />

            {/* DRIVER */}
            <div className="card white-card info-card driver-card">
              <div className="info-card-header">
                <span className="info-icon"><PersonIcon /></span>
                <span className="info-card-title">DRIVER</span>
                {fp.status === S.DONE && <span className="check-badge">✓</span>}
                {fp.status === S.SCANNING && <span className="scanning-dot"></span>}
              </div>

              {fp.status === S.IDLE && (
                <p className="info-empty">Awaiting fingerprint scan</p>
              )}
              {fp.status === S.SCANNING && (
                <p className="info-scanning">Scanning fingerprint…</p>
              )}
              {fp.status === S.DONE && (
                <div className="driver-body">
                  <div className="driver-photo"><PersonPhotoIcon /></div>
                  <div className="driver-details">
                    <div className="driver-name">{fp.name}</div>
                    <div className="driver-id">{fp.driverId}</div>
                    <span className="fingerprint-badge">
                      <FingerprintIcon /> Fingerprint Verified
                      <span className="fp-tick">✓</span>
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* GATE CONTROL */}
            <div className="card gate-card">
              <div className="gate-checks">
                <CheckRow label="RFID" checked={rfid.status === S.DONE} scanning={rfid.status === S.SCANNING} />
                <CheckRow label="License Plate" checked={anpr.status === S.DONE} scanning={anpr.status === S.SCANNING} />
                <CheckRow label="Driver Verification" checked={fp.status === S.DONE} scanning={fp.status === S.SCANNING} />
                <CheckRow label="Assignment Valid" checked={assign.status === S.DONE} scanning={assign.status === S.SCANNING} />
              </div>

              <div className="gate-auto-row">
                <span>Open Automatically</span>
                {/* FRONTEND CONTROL */}
                <div
                  className={`toggle-switch ${autoOpen ? "on" : "off"}`}
                  onClick={() => setAutoOpen((v) => !v)}
                >
                  <div className="toggle-thumb"></div>
                </div>
              </div>

              {/* FRONTEND CONTROL */}
              <button
                className={`btn-primary ${gateAnim ? "gate-pop" : ""} ${!allVerified ? "btn-disabled" : ""}`}
                onClick={() => allVerified && openGate()}
                disabled={!allVerified}
              >
                {gateOpen ? "🔓 Gate Open" : "Open Gate"}
              </button>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   REUSABLE COMPONENTS
────────────────────────────────────────────── */
function InfoCard({ icon, title, status, value, subvalue, scanLabel, emptyLabel }) {
  return (
    <div className="card white-card info-card">
      <div className="info-card-header">
        <span className="info-icon">{icon}</span>
        <span className="info-card-title">{title}</span>
        {status === S.DONE    && <span className="check-badge">✓</span>}
        {status === S.SCANNING && <span className="scanning-dot"></span>}
      </div>
      {status === S.IDLE     && <p className="info-empty">{emptyLabel}</p>}
      {status === S.SCANNING && <p className="info-scanning">{scanLabel}</p>}
      {status === S.DONE && (
        <>
          <div className="info-card-value">{value}</div>
          {subvalue && <div className="info-card-sub">{subvalue}</div>}
        </>
      )}
    </div>
  );
}

function CheckRow({ label, checked, scanning }) {
  return (
    <div className="check-row">
      <span className={`check-circle ${checked ? "checked" : scanning ? "pulsing" : "empty"}`}>
        {checked ? "✓" : scanning ? "…" : "○"}
      </span>
      <span>{label}</span>
    </div>
  );
}

/* ─── SVG Icons ─── */
const HamburgerIcon = () => (
  <svg width="18" height="14" viewBox="0 0 18 14" fill="none">
    <rect width="18" height="2" rx="1" fill="currentColor"/>
    <rect y="6" width="18" height="2" rx="1" fill="currentColor"/>
    <rect y="12" width="18" height="2" rx="1" fill="currentColor"/>
  </svg>
);
const AvatarIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <circle cx="10" cy="7" r="4" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M2 18c0-4 3.6-6 8-6s8 2 8 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);
const WifiIcon = () => (
  <svg width="14" height="12" viewBox="0 0 24 18" fill="none">
    <path d="M1 6C5 2 10.5 0 12 0s7 2 11 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M4 10c2-2 4.5-3 8-3s6 1 8 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M7.5 14c1-1 2.5-1.5 4.5-1.5s3.5.5 4.5 1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <circle cx="12" cy="17" r="1.5" fill="currentColor"/>
  </svg>
);
const PlateIcon = () => (
  <svg width="14" height="11" viewBox="0 0 22 16" fill="none">
    <rect x="1" y="1" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.5"/>
    <rect x="4" y="4" width="14" height="8" rx="1" stroke="currentColor" strokeWidth="1.2"/>
  </svg>
);
const PersonIcon = () => (
  <svg width="12" height="14" viewBox="0 0 18 20" fill="none">
    <circle cx="9" cy="6" r="5" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M1 19c0-4 3.5-7 8-7s8 3 8 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);
const PersonPhotoIcon = () => (
  <svg width="100%" height="100%" viewBox="0 0 60 70" fill="none">
    <circle cx="30" cy="24" r="14" fill="#cbd5e1"/>
    <path d="M4 68c0-14 11-22 26-22s26 8 26 22" fill="#cbd5e1"/>
  </svg>
);
const FingerprintIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
    <path d="M12 2C8 2 5 5 5 9c0 5 2 9 3 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M19 9c0-4-3-7-7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M8 11c0 3 1 6 2 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M16 11c0 3-1 6-2 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M12 10v5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);