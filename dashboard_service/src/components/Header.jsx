import { useState } from "react";
import {
  Box,
  Button,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Tooltip,
  Typography,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import LightModeOutlinedIcon from "@mui/icons-material/LightModeOutlined";
import DarkModeOutlinedIcon from "@mui/icons-material/DarkModeOutlined";
import AssignmentOutlinedIcon from "@mui/icons-material/AssignmentOutlined";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import BadgeOutlinedIcon from "@mui/icons-material/BadgeOutlined";
import NotificationsOutlinedIcon from "@mui/icons-material/NotificationsOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import { NavLink } from "react-router-dom";
import { useTheme } from "@mui/material/styles";
import { useColorMode } from "../ColorModeContext";

const DRAWER_WIDTH = 280;

export function Header({
  wsConnected,
  backendConnected = true,
  offlineStatusLabel = "OFFLINE",
  user,
  onLogout,
  /** Production: show hamburger → drawer with links to /admin/* */
  adminNavEnabled = false,
}) {
  const theme = useTheme();
  const { mode, toggleColorMode } = useColorMode();
  const isDark = theme.palette.mode === "dark";
  const [navOpen, setNavOpen] = useState(false);

  const initials = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase()
    : "?";

  const navLinkSx = {
    borderRadius: 1,
    mx: 1,
    "&.active": {
      bgcolor: "primary.main",
      color: "primary.contrastText",
      "& .MuiListItemIcon-root": { color: "inherit" },
    },
  };

  return (
    <>
      {adminNavEnabled && (
        <Drawer
          anchor="left"
          open={navOpen}
          onClose={() => setNavOpen(false)}
          PaperProps={{
            sx: {
              width: DRAWER_WIDTH,
              boxSizing: "border-box",
              bgcolor: "background.paper",
              borderRight: 1,
              borderColor: "divider",
            },
          }}
        >
          <Box sx={{ px: 2, py: 2.5, borderBottom: 1, borderColor: "divider" }}>
            <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1.2 }}>
              Navigation
            </Typography>
            <Typography variant="h6" fontWeight={700} sx={{ mt: 0.5, lineHeight: 1.2 }}>
              Barricade
            </Typography>
            <Typography variant="body2" color="text.secondary" noWrap>
              {user?.name || "Operator"}
            </Typography>
          </Box>
          <List disablePadding sx={{ py: 1 }}>
            <ListSubheader sx={{ bgcolor: "transparent", lineHeight: "32px", mt: 1 }}>
              Administration
            </ListSubheader>
            <ListItemButton
              component={NavLink}
              to="/admin/orders"
              onClick={() => setNavOpen(false)}
              sx={navLinkSx}
            >
              <ListItemIcon sx={{ minWidth: 40 }}>
                <AssignmentOutlinedIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="Orders" primaryTypographyProps={{ fontWeight: 600 }} />
            </ListItemButton>
            <ListItemButton
              component={NavLink}
              to="/admin/trucks"
              onClick={() => setNavOpen(false)}
              sx={navLinkSx}
            >
              <ListItemIcon sx={{ minWidth: 40 }}>
                <LocalShippingOutlinedIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="Trucks" primaryTypographyProps={{ fontWeight: 600 }} />
            </ListItemButton>
            <ListItemButton
              component={NavLink}
              to="/admin/drivers"
              onClick={() => setNavOpen(false)}
              sx={navLinkSx}
            >
              <ListItemIcon sx={{ minWidth: 40 }}>
                <BadgeOutlinedIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="Drivers" primaryTypographyProps={{ fontWeight: 600 }} />
            </ListItemButton>
            {user?.role === "admin" && (
              <>
                <Divider sx={{ my: 1, mx: 1 }} />
                <ListSubheader sx={{ bgcolor: "transparent", lineHeight: "32px" }}>
                  Security
                </ListSubheader>
                <ListItemButton
                  component={NavLink}
                  to="/admin/alerts"
                  onClick={() => setNavOpen(false)}
                  sx={navLinkSx}
                >
                  <ListItemIcon sx={{ minWidth: 40 }}>
                    <NotificationsOutlinedIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText primary="Alerts" primaryTypographyProps={{ fontWeight: 600 }} />
                </ListItemButton>
              </>
            )}
            <Divider sx={{ my: 1, mx: 1 }} />
            <ListSubheader sx={{ bgcolor: "transparent", lineHeight: "32px" }}>
              System
            </ListSubheader>
            <ListItemButton
              component={NavLink}
              to="/admin/configuration"
              onClick={() => setNavOpen(false)}
              sx={navLinkSx}
            >
              <ListItemIcon sx={{ minWidth: 40 }}>
                <SettingsOutlinedIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="Configuration" primaryTypographyProps={{ fontWeight: 600 }} />
            </ListItemButton>
          </List>
        </Drawer>
      )}

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
        {adminNavEnabled ? (
          <IconButton
            size="small"
            edge="start"
            aria-label="Open menu — administration"
            onClick={() => setNavOpen(true)}
            sx={{
              color: "text.secondary",
              "&:hover": { bgcolor: "action.hover" },
            }}
          >
            <MenuIcon fontSize="small" />
          </IconButton>
        ) : (
          <Box sx={{ width: 40, height: 40 }} aria-hidden />
        )}

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
                bgcolor: wsConnected ? "success.main" : "error.main",
                boxShadow: (t) =>
                  wsConnected
                    ? `0 0 0 3px ${t.palette.success.main}33`
                    : `0 0 0 3px ${t.palette.error.main}33`,
              }}
            />
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", lineHeight: 1.2 }}>
                Dashboard
              </Typography>
              <Typography
                variant="body2"
                fontWeight={600}
                color={wsConnected ? "success.main" : "error.main"}
              >
                {wsConnected ? "Online" : offlineStatusLabel}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Box
              component="span"
              sx={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                bgcolor: backendConnected ? "success.main" : "error.main",
                boxShadow: (t) =>
                  backendConnected
                    ? `0 0 0 3px ${t.palette.success.main}33`
                    : `0 0 0 3px ${t.palette.error.main}33`,
              }}
            />
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", lineHeight: 1.2 }}>
                Server
              </Typography>
              <Typography
                variant="body2"
                fontWeight={600}
                color={backendConnected ? "success.main" : "error.main"}
              >
                {backendConnected ? "Online" : "OFFLINE"}
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

          {wsConnected && backendConnected && (
            <>
              <Divider
                orientation="vertical"
                flexItem
                sx={{ display: { xs: "none", md: "block" }, alignSelf: "stretch", my: 0.5 }}
              />
              <Box sx={{ maxWidth: 280 }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", lineHeight: 1.2 }}>
                  Verification
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                  Starts when the RFID reader sends a tag
                </Typography>
              </Box>
            </>
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
    </>
  );
}
