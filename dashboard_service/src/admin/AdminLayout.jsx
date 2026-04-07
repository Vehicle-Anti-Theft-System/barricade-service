import {
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Toolbar,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import AssignmentOutlinedIcon from "@mui/icons-material/AssignmentOutlined";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import BadgeOutlinedIcon from "@mui/icons-material/BadgeOutlined";
import NotificationsOutlinedIcon from "@mui/icons-material/NotificationsOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined";
import { alpha } from "@mui/material/styles";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";

const SIDEBAR_W = 264;

const navLinkSx = {
  borderRadius: 1.5,
  mx: 1,
  py: 1,
  "&.active": {
    bgcolor: (t) => alpha(t.palette.primary.main, 0.14),
    color: "primary.main",
    fontWeight: 700,
    "& .MuiListItemIcon-root": { color: "primary.main" },
  },
};

function sectionTitle(pathname) {
  if (pathname.includes("/alerts")) return "Alerts";
  if (pathname.includes("/configuration")) return "Configuration";
  if (pathname.includes("/trucks")) return "Trucks";
  if (pathname.includes("/drivers")) return "Drivers";
  return "Orders";
}

export function AdminLayout({ user, onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();
  const canEdit = user?.role === "admin";
  const title = sectionTitle(location.pathname);

  return (
    <Box
      sx={{
        display: "flex",
        minHeight: "100vh",
        bgcolor: (t) => (t.palette.mode === "dark" ? "grey.900" : "grey.50"),
      }}
    >
      <Box
        component="aside"
        sx={{
          width: SIDEBAR_W,
          flexShrink: 0,
          borderRight: 1,
          borderColor: "divider",
          bgcolor: "background.paper",
          display: "flex",
          flexDirection: "column",
          boxShadow: (t) =>
            t.palette.mode === "dark" ? "none" : "4px 0 24px rgba(0,0,0,0.04)",
        }}
      >
        <Box sx={{ px: 2.5, pt: 3, pb: 2, borderBottom: 1, borderColor: "divider" }}>
          <Typography
            variant="overline"
            sx={{ color: "primary.main", fontWeight: 800, letterSpacing: 2, fontSize: "0.65rem" }}
          >
            Administration
          </Typography>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mt: 0.5 }} noWrap title={user?.email}>
            {user?.email || user?.name}
          </Typography>
          {!canEdit && (
            <Chip size="small" label="Read-only" sx={{ mt: 1, height: 22, fontSize: "0.7rem" }} />
          )}
        </Box>

        <List disablePadding sx={{ py: 2, flex: 1 }}>
          <ListSubheader
            disableSticky
            sx={{ bgcolor: "transparent", lineHeight: "28px", fontSize: "0.7rem", fontWeight: 700, letterSpacing: 1, color: "text.secondary", px: 2.5 }}
          >
            Data
          </ListSubheader>
          <ListItemButton component={NavLink} to="/admin/orders" sx={navLinkSx}>
            <ListItemIcon sx={{ minWidth: 42 }}>
              <AssignmentOutlinedIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Orders" primaryTypographyProps={{ fontWeight: 600 }} />
          </ListItemButton>
          <ListItemButton component={NavLink} to="/admin/trucks" sx={navLinkSx}>
            <ListItemIcon sx={{ minWidth: 42 }}>
              <LocalShippingOutlinedIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Trucks" primaryTypographyProps={{ fontWeight: 600 }} />
          </ListItemButton>
          <ListItemButton component={NavLink} to="/admin/drivers" sx={navLinkSx}>
            <ListItemIcon sx={{ minWidth: 42 }}>
              <BadgeOutlinedIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Drivers" primaryTypographyProps={{ fontWeight: 600 }} />
          </ListItemButton>

          {canEdit && (
            <>
              <Divider sx={{ my: 1.5, mx: 2 }} />
              <ListSubheader
                disableSticky
                sx={{ bgcolor: "transparent", lineHeight: "28px", fontSize: "0.7rem", fontWeight: 700, letterSpacing: 1, color: "text.secondary", px: 2.5 }}
              >
                Security
              </ListSubheader>
              <ListItemButton component={NavLink} to="/admin/alerts" sx={navLinkSx}>
                <ListItemIcon sx={{ minWidth: 42 }}>
                  <NotificationsOutlinedIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary="Alerts" primaryTypographyProps={{ fontWeight: 600 }} />
              </ListItemButton>
            </>
          )}

          <Divider sx={{ my: 1.5, mx: 2 }} />
          <ListSubheader
            disableSticky
            sx={{ bgcolor: "transparent", lineHeight: "28px", fontSize: "0.7rem", fontWeight: 700, letterSpacing: 1, color: "text.secondary", px: 2.5 }}
          >
            System
          </ListSubheader>
          <ListItemButton component={NavLink} to="/admin/configuration" sx={navLinkSx}>
            <ListItemIcon sx={{ minWidth: 42 }}>
              <SettingsOutlinedIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Configuration" primaryTypographyProps={{ fontWeight: 600 }} />
          </ListItemButton>
        </List>

        <Box sx={{ p: 2, borderTop: 1, borderColor: "divider" }}>
          <Button
            fullWidth
            variant="outlined"
            color="inherit"
            startIcon={<LogoutOutlinedIcon />}
            onClick={onLogout}
            sx={{ justifyContent: "flex-start", borderRadius: 2, textTransform: "none", fontWeight: 600 }}
          >
            Log out
          </Button>
        </Box>
      </Box>

      <Box sx={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <Toolbar
          sx={{
            minHeight: { xs: 56, sm: 64 },
            px: { xs: 2, sm: 3 },
            bgcolor: "background.paper",
            borderBottom: 1,
            borderColor: "divider",
            gap: 2,
          }}
        >
          <Typography variant="h6" component="h1" sx={{ flexGrow: 1, fontWeight: 700 }}>
            {title}
          </Typography>
          <IconButton
            edge="end"
            color="inherit"
            aria-label="Close admin and return to gate"
            onClick={() => navigate("/")}
            sx={{
              bgcolor: (t) => alpha(t.palette.text.primary, 0.06),
              "&:hover": { bgcolor: (t) => alpha(t.palette.text.primary, 0.12) },
            }}
          >
            <CloseIcon />
          </IconButton>
        </Toolbar>

        <Box
          component="main"
          sx={{
            flex: 1,
            overflow: "auto",
            p: { xs: 2, sm: 3 },
          }}
        >
          <Outlet context={{ canEdit }} />
        </Box>
      </Box>
    </Box>
  );
}
