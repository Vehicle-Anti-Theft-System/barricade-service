import { useState, useEffect } from "react";
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
  LoginPage,
} from "./components";
import { useVerificationState } from "./hooks/useVerificationState";
import { useWebSocket } from "./hooks/useWebSocket";
import { useAuth } from "./hooks/useAuth";
import { ANPR_STATES } from "./constants";

const theme = createTheme({
  palette: {
    primary: { main: "#3b82f6" },
    success: { main: "#22c55e" },
    error: { main: "#ef4444" },
  },
});

export default function AppAgent() {
  const { user, isAuthenticated, loading: authLoading, error: authError, login, logout, clearError } = useAuth();
  const [state, dispatch] = useVerificationState();
  const [autoOpen, setAutoOpen] = useState(true);
  const [wsConnected, setWsConnected] = useState(false);
  const [manualPlateOpen, setManualPlateOpen] = useState(false);
  const [rescanning, setRescanning] = useState(false);

  const { send } = useWebSocket(dispatch, {
    onConnect: () => setWsConnected(true),
    onDisconnect: () => setWsConnected(false),
    enableDemoMode: false,
  });

  function handleStartVerification() {
    if (!wsConnected || !send) return;
    send({
      event: "simulate",
      employee_id: user?.employeeId ?? null,
      auto_open: autoOpen,
    });
  }

  useEffect(() => {
    if (state.sessionPhase === "complete" && autoOpen && !state.gateOpen) {
      dispatch({ type: "gate_decision", payload: { open: true, method: "auto" } });
    }
  }, [state.sessionPhase, autoOpen, state.gateOpen, dispatch]);

  useEffect(() => {
    if (state.gateAnim) {
      const t = setTimeout(() => {
        dispatch({ type: "gate_anim_done" });
      }, 600);
      return () => clearTimeout(t);
    }
  }, [state.gateAnim, dispatch]);

  useEffect(() => {
    if (state.anpr?.status === ANPR_STATES.MANUAL_ENTRY) {
      setManualPlateOpen(true);
    }
  }, [state.anpr?.status]);

  function handleRescan() {
    setRescanning(true);
    dispatch({ type: "session_reset" });
    if (wsConnected && send) send({ event: "session_reset" });
    setTimeout(() => setRescanning(false), 300);
  }

  function handleManualPlateSubmit(plate) {
    if (wsConnected && send) {
      send({ event: "manual_plate", plate });
    } else {
      dispatch({ type: "anpr_manual_submit", payload: { plate } });
    }
    setManualPlateOpen(false);
  }

  function handleOpenGate() {
    if (wsConnected && send) {
      send({ event: "open_gate" });
    } else {
      dispatch({ type: "gate_open_click" });
    }
  }

  if (!isAuthenticated) {
    return (
      <ThemeProvider theme={theme}>
        <LoginPage
          onLogin={login}
          loading={authLoading}
          error={authError}
          onClearError={clearError}
        />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <div className="screen">
        <div className="main-container">
          <Header
            wsConnected={wsConnected}
            onStartVerification={handleStartVerification}
            showSimulationControls={false}
            startDisabled={!wsConnected}
            offlineStatusLabel="OFFLINE"
            user={user}
            onLogout={logout}
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
              <DriverCard rfid={state.rfid} />

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
