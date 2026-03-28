import { createTheme } from "@mui/material/styles";

/**
 * Minimal, modern MUI theme. Use with ColorModeProvider (light / dark).
 */
export function createDashboardTheme(mode) {
  const isDark = mode === "dark";

  return createTheme({
    palette: {
      mode,
      primary: { main: isDark ? "#60a5fa" : "#2563eb" },
      secondary: { main: isDark ? "#a3a3a3" : "#525252" },
      success: { main: isDark ? "#4ade80" : "#16a34a" },
      error: { main: isDark ? "#f87171" : "#dc2626" },
      warning: { main: isDark ? "#fbbf24" : "#d97706" },
      info: { main: isDark ? "#38bdf8" : "#0284c7" },
      background: {
        default: isDark ? "#0a0a0a" : "#f5f5f5",
        paper: isDark ? "#171717" : "#ffffff",
      },
      divider: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)",
      text: {
        primary: isDark ? "#fafafa" : "#171717",
        secondary: isDark ? "#a3a3a3" : "#737373",
      },
    },
    typography: {
      fontFamily:
        '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      h5: { fontWeight: 600, letterSpacing: "-0.02em" },
      h6: { fontWeight: 600 },
      button: { fontWeight: 500, textTransform: "none" },
    },
    shape: { borderRadius: 10 },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            textRendering: "optimizeLegibility",
          },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            borderRadius: 8,
            transition: "background-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease",
          },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            transition: "background-color 0.15s ease",
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 8,
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: ({ theme }) => ({
            borderRadius: 12,
            border: `1px solid ${theme.palette.divider}`,
          }),
        },
      },
      MuiChip: {
        styleOverrides: {
          root: { fontWeight: 500, fontSize: "0.7rem" },
        },
      },
    },
  });
}
