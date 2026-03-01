import { useState, useEffect, useRef } from "react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import "./App.css";
import {
  Header,
  CameraFeed,
  SessionLog,
  StatusBadge,
  DriverCard,
  GateControl,
  ManualPlateEntryDialog,
} from "./components";
import { useVerificationState } from "./hooks/useVerificationState";
import { useWebSocket } from "./hooks/useWebSocket";
import { ANPR_STATES } from "./constants";

const theme = createTheme({
  palette: {
    primary: { main: "#3b82f6" },
    success: { main: "#22c55e" },
    error: { main: "#ef4444" },
  },
});

export default function App() {
  const [state, dispatch] = useVerificationState();
  const [autoOpen, setAutoOpen] = useState(true);
  const [wsConnected, setWsConnected] = useState(false);
  const [manualPlateOpen, setManualPlateOpen] = useState(false);
  const [rescanning, setRescanning] = useState(false);
  const wsRef = useRef(null);

  const { simulateDemoFlow } = useWebSocket(dispatch, {
    onConnect: () => setWsConnected(true),
    onDisconnect: () => setWsConnected(false),
    enableDemoMode: true,
  });

  wsRef.current = { simulateDemoFlow };

  // Auto-open gate when verification complete and autoOpen is on
  useEffect(() => {
    if (
      state.sessionPhase === "complete" &&
      autoOpen &&
      !state.gateOpen
    ) {
      dispatch({ type: "gate_decision", payload: { open: true, method: "auto" } });
    }
  }, [state.sessionPhase, autoOpen, state.gateOpen, dispatch]);

  // Reset gate animation after a delay
  useEffect(() => {
    if (state.gateAnim) {
      const t = setTimeout(() => {
        dispatch({ type: "gate_anim_done" });
      }, 600);
      return () => clearTimeout(t);
    }
  }, [state.gateAnim, dispatch]);

  // Show manual plate entry when ANPR requests it
  useEffect(() => {
    if (state.anpr?.status === ANPR_STATES.MANUAL_ENTRY) {
      setManualPlateOpen(true);
    }
  }, [state.anpr?.status]);

  function handleRescan() {
    setRescanning(true);
    dispatch({ type: "session_reset" });
    setTimeout(() => setRescanning(false), 300);
  }

  function handleManualPlateSubmit(plate) {
    dispatch({ type: "anpr_manual_submit", payload: { plate } });
    setManualPlateOpen(false);
  }

  function handleOpenGate() {
    dispatch({ type: "gate_open_click" });
  }

  return (
    <ThemeProvider theme={theme}>
      <div className="screen">
        <div className="main-container">
          <Header
            wsConnected={wsConnected}
            onSimulateDemo={() => wsRef.current?.simulateDemoFlow()}
          />

          <div className="content">
            <div className="left">
              <CameraFeed anpr={state.anpr} sessionPhase={state.sessionPhase} />
              <SessionLog
                logs={state.logs}
                sessionPhase={state.sessionPhase}
                onRescan={handleRescan}
                isRescanning={rescanning}
              />
            </div>

            <div className="right">
              <StatusBadge type="rfid" data={state.rfid} />
              <StatusBadge type="anpr" data={state.anpr} />
              <DriverCard fingerprint={state.fingerprint} />

              <div className="action-buttons-row">
                <button
                  className="action-btn"
                  onClick={handleRescan}
                  disabled={rescanning}
                  type="button"
                >
                  RESCAN
                </button>
                <button
                  className="action-btn"
                  onClick={() => setManualPlateOpen(true)}
                  type="button"
                  title="Manual plate entry (when ANPR fails 3x)"
                >
                  MANUAL PLATE ENTRY
                </button>
              </div>

              <GateControl
                rfid={state.rfid}
                anpr={state.anpr}
                fingerprint={state.fingerprint}
                autoOpen={autoOpen}
                onAutoOpenChange={setAutoOpen}
                gateOpen={state.gateOpen}
                gateAnim={state.gateAnim}
                onOpenGate={handleOpenGate}
              />
            </div>
          </div>
        </div>
      </div>

      <ManualPlateEntryDialog
        open={manualPlateOpen}
        onClose={() => setManualPlateOpen(false)}
        onSubmit={handleManualPlateSubmit}
      />
    </ThemeProvider>
  );
}
