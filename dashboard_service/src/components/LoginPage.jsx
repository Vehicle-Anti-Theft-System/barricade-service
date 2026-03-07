import { useState } from "react";
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  InputAdornment,
  IconButton,
  Alert,
  CircularProgress,
} from "@mui/material";
import BadgeIcon from "@mui/icons-material/Badge";
import LockIcon from "@mui/icons-material/Lock";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import SecurityIcon from "@mui/icons-material/Security";

export function LoginPage({ onLogin, loading, error, onClearError }) {
  const [employeeId, setEmployeeId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (employeeId.trim() && password) {
      onLogin(employeeId, password);
    }
  };

  const isFormValid = employeeId.trim() && password;

  return (
    <Box className="login-screen">
      <Card className="login-card" elevation={0}>
        <CardContent sx={{ p: 4 }}>
          <Box className="login-header">
            <Box className="login-icon-wrapper">
              <SecurityIcon sx={{ fontSize: 32, color: "white" }} />
            </Box>
            <Typography variant="h5" className="login-title">
              Barricade Control
            </Typography>
            <Typography variant="body2" className="login-subtitle">
              Mine Site Security System
            </Typography>
          </Box>

          {error && (
            <Alert
              severity="error"
              onClose={onClearError}
              sx={{ mb: 3, borderRadius: 2 }}
            >
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label="Employee ID"
              placeholder="Enter your employee ID"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              disabled={loading}
              sx={{ mb: 2.5 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <BadgeIcon sx={{ color: "#64748b" }} />
                  </InputAdornment>
                ),
              }}
            />

            <TextField
              fullWidth
              type={showPassword ? "text" : "password"}
              label="Password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              sx={{ mb: 3 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockIcon sx={{ color: "#64748b" }} />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                      size="small"
                    >
                      {showPassword ? (
                        <VisibilityOffIcon sx={{ fontSize: 20 }} />
                      ) : (
                        <VisibilityIcon sx={{ fontSize: 20 }} />
                      )}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={!isFormValid || loading}
              sx={{
                py: 1.5,
                fontWeight: 700,
                fontSize: "0.9rem",
                textTransform: "none",
                borderRadius: 2,
                boxShadow: "0 4px 14px rgba(59, 130, 246, 0.4)",
                "&:hover": {
                  boxShadow: "0 6px 20px rgba(59, 130, 246, 0.5)",
                },
              }}
            >
              {loading ? (
                <CircularProgress size={24} sx={{ color: "white" }} />
              ) : (
                "Sign In"
              )}
            </Button>
          </form>

          <Typography className="login-footer">
            Checkpoint: North Gate
          </Typography>
        </CardContent>
      </Card>

      <Typography className="login-version">
        Barricade Security v1.0
      </Typography>
    </Box>
  );
}
