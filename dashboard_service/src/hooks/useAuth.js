import { useState, useCallback, useEffect } from "react";
import { BACKEND_URL } from "../constants";
import { logger } from "../utils/logger";
import { getAccessTokenExpiryMs } from "../utils/jwtExpiry";

const STORAGE_KEY = "barricade_auth";

function normalizeUserFromApi(u) {
  if (!u) return null;
  return {
    id: u.id,
    email: u.email,
    role: u.role,
    fullName: u.full_name,
    name: u.full_name || u.email,
    employeeId: u.employee_id || null,
    checkpoint: "North Gate",
  };
}

function getStoredUser() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    if (parsed?.accessToken && parsed?.user) {
      return parsed;
    }
    if (parsed?.employeeId) {
      return { user: parsed, accessToken: null };
    }
    return null;
  } catch {
    return null;
  }
}

function initialAuthState() {
  const s = getStoredUser();
  if (BACKEND_URL && s?.accessToken) {
    const expMs = getAccessTokenExpiryMs(s.accessToken);
    if (expMs !== null && expMs <= Date.now()) {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
      logger.info("Stored access token already expired — cleared");
      return null;
    }
  }
  return s;
}

export function useAuth() {
  const [auth, setAuth] = useState(() => initialAuthState());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const user = auth?.user ?? null;
  const isAuthenticated = !!(auth?.accessToken && auth?.user);

  useEffect(() => {
    const onSessionExpired = () => {
      logger.info("Session cleared (token invalid or expired on API)");
      setAuth(null);
      setError(null);
    };
    window.addEventListener("barricade:session-expired", onSessionExpired);
    return () => window.removeEventListener("barricade:session-expired", onSessionExpired);
  }, []);

  useEffect(() => {
    if (!BACKEND_URL || !auth?.accessToken) return undefined;
    const expMs = getAccessTokenExpiryMs(auth.accessToken);
    if (expMs === null) return undefined;
    const skewMs = 5000;
    const delay = expMs - Date.now() - skewMs;
    if (delay <= 0) {
      logger.info("Access token expired — logging out");
      localStorage.removeItem(STORAGE_KEY);
      setAuth(null);
      setError(null);
      return undefined;
    }
    const id = window.setTimeout(() => {
      logger.info("Access token expired — logging out");
      localStorage.removeItem(STORAGE_KEY);
      setAuth(null);
      setError(null);
    }, delay);
    return () => window.clearTimeout(id);
  }, [auth?.accessToken]);

  const login = useCallback(async (emailOrId, password) => {
    setLoading(true);
    setError(null);

    if (BACKEND_URL) {
      const email = String(emailOrId || "").trim().toLowerCase();
      try {
        const url = `${BACKEND_URL}/api/auth/login`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ username: email, password }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          const msg =
            typeof data.detail === "string"
              ? data.detail
              : Array.isArray(data.detail)
                ? data.detail.map((d) => d.msg || JSON.stringify(d)).join(", ")
                : "Invalid email or password";
          setError(msg);
          setLoading(false);
          logger.warn("Login failed:", msg);
          return false;
        }
        const next = {
          accessToken: data.access_token,
          user: normalizeUserFromApi(data.user),
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        setAuth(next);
        setLoading(false);
        logger.info("Login successful:", next.user?.email);
        return true;
      } catch (e) {
        const msg = e?.message || "Could not reach backend (check VITE_BACKEND_URL)";
        setError(msg);
        setLoading(false);
        logger.warn("Login error:", e);
        return false;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 400));
    if (password === "barricade123" && String(emailOrId || "").trim()) {
      const id = String(emailOrId).trim().toUpperCase();
      const legacy = {
        employeeId: id,
        name: `Guard ${id.slice(-3) || "001"}`,
        role: "security_guard",
        checkpoint: "North Gate",
        loginTime: new Date().toISOString(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(legacy));
      setAuth({ user: legacy, accessToken: null });
      setLoading(false);
      logger.info("Demo login:", id);
      return true;
    }
    setError("Invalid Employee ID or Password (demo: any ID + barricade123)");
    setLoading(false);
    return false;
  }, []);

  const logout = useCallback(() => {
    logger.info("Logout");
    localStorage.removeItem(STORAGE_KEY);
    setAuth(null);
    setError(null);
  }, []);

  return {
    user,
    accessToken: auth?.accessToken ?? null,
    isAuthenticated: BACKEND_URL ? isAuthenticated : !!(auth?.user),
    loading,
    error,
    login,
    logout,
    clearError: () => setError(null),
    usesBackendAuth: !!BACKEND_URL,
  };
}
