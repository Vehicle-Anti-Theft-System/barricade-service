import { useState, useCallback } from "react";

const STORAGE_KEY = "barricade_auth";

function getStoredUser() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

export function useAuth() {
  const [user, setUser] = useState(getStoredUser);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const login = useCallback(async (employeeId, password) => {
    setLoading(true);
    setError(null);

    // Mock authentication - replace with real API call
    await new Promise((resolve) => setTimeout(resolve, 800));

    // Demo credentials: any employee ID with password "barricade123"
    if (password === "barricade123" && employeeId.trim()) {
      const userData = {
        employeeId: employeeId.trim().toUpperCase(),
        name: `Guard ${employeeId.slice(-3) || "001"}`,
        role: "security_guard",
        checkpoint: "North Gate",
        loginTime: new Date().toISOString(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
      setUser(userData);
      setLoading(false);
      return true;
    }

    setError("Invalid Employee ID or Password");
    setLoading(false);
    return false;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
    setError(null);
  }, []);

  return {
    user,
    isAuthenticated: !!user,
    loading,
    error,
    login,
    logout,
    clearError: () => setError(null),
  };
}
