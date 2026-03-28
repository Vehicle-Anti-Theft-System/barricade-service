import {
  Box,
  Button,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Tooltip,
  Typography,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import LightModeOutlinedIcon from "@mui/icons-material/LightModeOutlined";
import DarkModeOutlinedIcon from "@mui/icons-material/DarkModeOutlined";
import { useTheme } from "@mui/material/styles";
import { useColorMode } from "../ColorModeContext";

export function Header({
  wsConnected,
  onStartVerification,
  simulateCase,
  onSimulateCaseChange,
  showSimulationControls = true,
  startDisabled = false,
  offlineStatusLabel = "DEMO",
  user,
  onLogout,
}) {
  const theme = useTheme();
  const { mode, toggleColorMode } = useColorMode();
  const isDark = theme.palette.mode === "dark";

  const initials = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase()
    : "?";

  return (
    <Box
      component="header"
      sx={{
        display: "grid",
        gridTemplateColumns: "auto minmax(0, 1fr) auto",
        alignItems: "center",
        columnGap: { xs: 1, sm: 2 },
        rowGap: 1,
        px: { xs: 1.5, sm: 2 },
        py: 1.25,
        mb: 2,
        borderRadius: 2,
        bgcolor: "background.paper",
        border: 1,
        borderColor: "divider",
        boxShadow: (t) =>
          t.palette.mode === "dark"
            ? "0 1px 0 rgba(255,255,255,0.04) inset"
            : "0 1px 0 rgba(255,255,255,0.7) inset",
      }}
    >
      <IconButton
        size="small"
        edge="start"
        aria-label="Menu"
        sx={{
          color: "text.secondary",
          "&:hover": { bgcolor: "action.hover" },
        }}
      >
        <MenuIcon fontSize="small" />
      </IconButton>

      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: { xs: 1, sm: 2 },
          flexWrap: "wrap",
          minWidth: 0,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Box
            component="span"
            sx={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              bgcolor: wsConnected ? "success.main" : "warning.main",
              boxShadow: (t) =>
                wsConnected
                  ? `0 0 0 3px ${t.palette.success.main}33`
                  : `0 0 0 3px ${t.palette.warning.main}33`,
            }}
          />
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", lineHeight: 1.2 }}>
              Connection
            </Typography>
            <Typography
              variant="body2"
              fontWeight={600}
              color={wsConnected ? "success.main" : "warning.main"}
            >
              {wsConnected ? "Online" : offlineStatusLabel}
            </Typography>
          </Box>
        </Box>

        <Divider
          orientation="vertical"
          flexItem
          sx={{ display: { xs: "none", sm: "block" }, alignSelf: "stretch", my: 0.5 }}
        />

        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", lineHeight: 1.2 }}>
            Checkpoint
          </Typography>
          <Typography variant="body2" fontWeight={500}>
            {user?.checkpoint || "North Gate"}
          </Typography>
        </Box>

        {onStartVerification && (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              flexWrap: "wrap",
              ml: { xs: 0, sm: 0 },
            }}
          >
            <Divider
              orientation="vertical"
              flexItem
              sx={{ display: { xs: "none", md: "block" }, alignSelf: "stretch", my: 0.5 }}
            />
            {showSimulationControls && (
              <FormControl size="small" sx={{ minWidth: 170 }}>
                <InputLabel id="simulate-case-label">Simulation</InputLabel>
                <Select
                  labelId="simulate-case-label"
                  value={simulateCase}
                  label="Simulation"
                  onChange={(e) => onSimulateCaseChange?.(e.target.value)}
                >
                  <MenuItem value="success">Success</MenuItem>
                  <MenuItem value="rfid_mismatch">RFID mismatch</MenuItem>
                  <MenuItem value="anpr_mismatch">ANPR mismatch</MenuItem>
                </Select>
              </FormControl>
            )}
            <Button
              variant="contained"
              color="primary"
              size="small"
              onClick={onStartVerification}
              disabled={startDisabled}
              title={
                wsConnected
                  ? "Start verification (API Agent)"
                  : showSimulationControls
                    ? "Simulate verification (demo)"
                    : "API Agent is offline"
              }
            >
              {wsConnected ? "Start verification" : showSimulationControls ? "Simulate" : "Start verification"}
            </Button>
          </Box>
        )}
      </Box>

      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, justifySelf: "end" }}>
        <Tooltip title={isDark ? "Light mode" : "Dark mode"} placement="bottom">
          <IconButton
            onClick={toggleColorMode}
            size="small"
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            sx={{ color: "text.secondary", "&:hover": { bgcolor: "action.hover" } }}
          >
            {isDark ? <LightModeOutlinedIcon fontSize="small" /> : <DarkModeOutlinedIcon fontSize="small" />}
          </IconButton>
        </Tooltip>

        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            pl: 1,
            ml: 0.5,
            borderLeft: 1,
            borderColor: "divider",
          }}
        >
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: 1,
              bgcolor: mode === "dark" ? "grey.800" : "grey.200",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              typography: "caption",
              fontWeight: 700,
              color: "text.primary",
            }}
          >
            {initials}
          </Box>
          <Typography variant="body2" fontWeight={500} sx={{ display: { xs: "none", md: "block" } }}>
            {user?.name || "Guard"}
          </Typography>
          {onLogout && (
            <Button
              size="small"
              variant="text"
              color="inherit"
              onClick={onLogout}
              sx={{ minWidth: "auto", px: 1, fontWeight: 500 }}
            >
              Log out
            </Button>
          )}
        </Box>
      </Box>
    </Box>
  );
}
