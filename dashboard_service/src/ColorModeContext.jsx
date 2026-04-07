import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { createDashboardTheme } from "./theme";

const STORAGE_KEY = "barricade-color-mode";

const ColorModeContext = createContext({
  mode: "light",
  toggleColorMode: () => {},
  setMode: () => {},
});

export function useColorMode() {
  return useContext(ColorModeContext);
}

export function ColorModeProvider({ children }) {
  const [mode, setMode] = useState(() => {
    if (typeof window === "undefined") return "light";
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "dark" || stored === "light") return stored;
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  });

  useEffect(() => {
    document.documentElement.dataset.theme = mode;
    window.localStorage.setItem(STORAGE_KEY, mode);
  }, [mode]);

  const toggleColorMode = useCallback(() => {
    setMode((m) => (m === "light" ? "dark" : "light"));
  }, []);

  const theme = useMemo(() => createDashboardTheme(mode), [mode]);

  const value = useMemo(
    () => ({ mode, toggleColorMode, setMode }),
    [mode, toggleColorMode]
  );

  return (
    <ColorModeContext.Provider value={value}>
      <ThemeProvider theme={theme}>
        <CssBaseline enableColorScheme />
        {children}
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
}
