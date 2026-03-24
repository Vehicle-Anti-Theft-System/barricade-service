import { useState, useEffect, useRef } from "react";
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

export default function App() {
  const { user, isAuthenticated, loading: authLoading, error: authError, login, logout, clearError } = useAuth();
  const [state, dispatch] = useVerificationState();
  const [wsConnected, setWsConnected] = useState(false);
  const [manualPlateOpen, setManualPlateOpen] = useState(false);
  const [rescanning, setRescanning] = useState(false);
  const [simulateCase, setSimulateCase] = useState("success");
  const wsRef = useRef(null);

  const { simulateDemoFlow, send } = useWebSocket(dispatch, {
    onConnect: () => setWsConnected(true),
    onDisconnect: () => setWsConnected(false),
    enableDemoMode: true,
  });

  function handleStartVerification() {
    /** Align with offline demo: reset UI session so stale gateOpen cannot block Open barricade. */
    dispatch({ type: "session_reset", payload: {} });
    if (wsConnected && send) {
      send({
        event: "simulate",
        scenario: simulateCase,
        employee_id: user?.employeeId ?? null,
        auto_open: state.autoOpenEnabled,
      });
    } else {
      simulateDemoFlow?.(simulateCase);
    }
  }

  wsRef.current = { simulateDemoFlow: handleStartVerification };

  // Offline demo only: no API agent → nothing sends gate_decision. When online, the
  // server is the only source for automatic opens (respects simulate `auto_open`).
  useEffect(() => {
    if (wsConnected) return;
    if (
      state.sessionPhase === "complete" &&
      state.autoOpenEnabled &&
      !state.gateOpen
    ) {
      dispatch({ type: "gate_decision", payload: { open: true, method: "auto" } });
    }
  }, [wsConnected, state.sessionPhase, state.autoOpenEnabled, state.gateOpen, dispatch]);

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
    if (wsConnected && send) send({ event: "session_reset" });
    setTimeout(() => setRescanning(false), 300);
  }

  function handleManualPlateSubmit(plate) {
    if (wsConnected && send) {
      const ok = send({ event: "manual_plate", plate });
      if (!ok) {
        dispatch({
          type: "anpr_result",
          payload: {
            status: "FAILED",
            plate,
            detail: "Could not send to API agent (socket not ready).",
          },
        });
      }
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

  function handleAutoOpenChange(checked) {
    dispatch({ type: "set_auto_open", payload: { enabled: checked } });
    if (wsConnected && send) {
      send({ event: "set_auto_open", auto_open: checked });
    }
  }

  if (!isAuthenticated) {
    return (
      <LoginPage
        onLogin={login}
        loading={authLoading}
        error={authError}
        onClearError={clearError}
      />
    );
  }

  return (
    <>
    <div className="screen">
        <div className="main-container">
          <Header
            wsConnected={wsConnected}
            onStartVerification={handleStartVerification}
            simulateCase={simulateCase}
            onSimulateCaseChange={setSimulateCase}
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
                autoOpen={state.autoOpenEnabled}
                onAutoOpenChange={handleAutoOpenChange}
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
    </>
  );
}
