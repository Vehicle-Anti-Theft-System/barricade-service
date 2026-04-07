import { useState, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
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
import { AdminLayout } from "./admin/AdminLayout";
import { OrdersPage } from "./admin/OrdersPage";
import { TrucksPage } from "./admin/TrucksPage";
import { DriversPage } from "./admin/DriversPage";
import { ConfigurationPage } from "./admin/ConfigurationPage";
import { AlertsPage } from "./admin/AlertsPage";
import { useVerificationState } from "./hooks/useVerificationState";
import { useWebSocket } from "./hooks/useWebSocket";
import { useBackendHealthState } from "./hooks/useBackendHealth";
import { ANPR_STATES, BACKEND_URL } from "./constants";
import { useAuth } from "./hooks/useAuth";

function GateDashboard({ auth }) {
  const { user, usesBackendAuth, accessToken, login, logout, clearError, loading, error, isAuthenticated } =
    auth;
  const [state, dispatch] = useVerificationState();
  const [wsConnected, setWsConnected] = useState(false);
  const [manualPlateOpen, setManualPlateOpen] = useState(false);
  const [rescanning, setRescanning] = useState(false);
  const { backendConnected, setBackendConnected } = useBackendHealthState();

  const { send } = useWebSocket(dispatch, {
    onConnect: () => setWsConnected(true),
    onDisconnect: () => setWsConnected(false),
    onBackendHealth: BACKEND_URL ? setBackendConnected : undefined,
  });

  const employeePayload = user?.employeeId ?? null;

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
    dispatch({ type: "session_reset", payload: {} });
    if (wsConnected && send) send({ event: "session_reset" });
    setTimeout(() => setRescanning(false), 300);
  }

  function handleManualPlateSubmit(plate) {
    if (send) {
      const ok = send({ event: "manual_plate", plate, employee_id: employeePayload });
      if (!ok) {
        dispatch({
          type: "anpr_result",
          payload: {
            status: "FAILED",
            plate,
            detail:
              "Manual plate was not sent. Check API agent is running and status shows ONLINE.",
          },
        });
      }
    }
    setManualPlateOpen(false);
  }

  function handleOpenGate() {
    if (wsConnected && send) {
      send({ event: "open_gate", employee_id: employeePayload });
    } else {
      dispatch({ type: "gate_open_click" });
    }
  }

  function handleAutoOpenChange(checked) {
    dispatch({ type: "set_auto_open", payload: { enabled: checked } });
    if (wsConnected && send) {
      send({ event: "set_auto_open", auto_open: checked, employee_id: employeePayload });
    }
  }

  if (!isAuthenticated) {
    return (
      <LoginPage
        onLogin={login}
        loading={loading}
        error={error}
        onClearError={clearError}
        emailMode={usesBackendAuth}
      />
    );
  }

  const adminNavEnabled =
    usesBackendAuth && accessToken && (user?.role === "admin" || user?.role === "viewer");

  return (
    <>
      <div className="screen">
        <div className="main-container">
          <Header
            wsConnected={wsConnected}
            backendConnected={backendConnected}
            offlineStatusLabel="OFFLINE"
            user={user}
            onLogout={logout}
            adminNavEnabled={adminNavEnabled}
          />

          <div className="content">
            <div className="left">
              <CameraFeed anpr={state.anpr} sessionPhase={state.sessionPhase} />
              <SessionLog logs={state.logs} sessionPhase={state.sessionPhase} />
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

function AdminShell({ auth }) {
  const { user, usesBackendAuth, accessToken, isAuthenticated, logout } = auth;

  if (!usesBackendAuth || !accessToken || !isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (user?.role !== "admin" && user?.role !== "viewer") {
    return <Navigate to="/" replace />;
  }

  return <AdminLayout user={user} onLogout={logout} />;
}

function AppAgentRoutes({ auth }) {
  return (
    <Routes>
      <Route path="/admin" element={<AdminShell auth={auth} />}>
        <Route index element={<Navigate to="orders" replace />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="trucks" element={<TrucksPage />} />
        <Route path="drivers" element={<DriversPage />} />
        <Route path="alerts" element={<AlertsPage />} />
        <Route path="configuration" element={<ConfigurationPage />} />
      </Route>
      <Route path="/*" element={<GateDashboard auth={auth} />} />
    </Routes>
  );
}

export default function AppAgent() {
  const auth = useAuth();
  return <AppAgentRoutes auth={auth} />;
}
