import { useEffect, useState } from "react";
import {
  Alert as MuiAlert,
  Box,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import { apiFetch } from "../hooks/useBackendApi";

const TYPE_COLORS = {
  plate_mismatch: "error",
  plate_swap_suspected: "error",
  anpr_failure: "warning",
  rfid_no_order: "warning",
  rfid_unknown_tag: "info",
  rfid_inactive_truck: "info",
};

function formatDate(iso) {
  if (!iso) return "—";
  let s = iso;
  if (!s.endsWith("Z") && !s.includes("+") && !/\d{2}:\d{2}$/.test(s.slice(-6))) {
    s += "Z";
  }
  const d = new Date(s);
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function AlertsPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [typeFilter, setTypeFilter] = useState("");

  async function load(alertType) {
    setErr(null);
    setLoading(true);
    try {
      const query = alertType ? `?alert_type=${encodeURIComponent(alertType)}` : "";
      const data = await apiFetch(`/api/alerts/${query}`);
      setRows(data);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(typeFilter);
  }, [typeFilter]);

  if (loading) {
    return (
      <Paper elevation={0} sx={{ p: 6, borderRadius: 2, border: 1, borderColor: "divider" }}>
        <Box display="flex" justifyContent="center">
          <CircularProgress />
        </Box>
      </Paper>
    );
  }

  return (
    <Box>
      <Box display="flex" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={2} mb={2}>
        <Typography variant="body2" color="text.secondary">
          Security and verification alerts (newest first)
        </Typography>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Filter by type</InputLabel>
          <Select
            label="Filter by type"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <MenuItem value="">All types</MenuItem>
            <MenuItem value="plate_mismatch">Plate mismatch</MenuItem>
            <MenuItem value="plate_swap_suspected">Plate swap suspected</MenuItem>
            <MenuItem value="anpr_failure">ANPR failure</MenuItem>
            <MenuItem value="rfid_no_order">RFID — no order</MenuItem>
            <MenuItem value="rfid_unknown_tag">RFID — unknown tag</MenuItem>
            <MenuItem value="rfid_inactive_truck">RFID — inactive truck</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {err && (
        <MuiAlert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setErr(null)}>
          {err}
        </MuiAlert>
      )}

      <TableContainer
        component={Paper}
        elevation={0}
        sx={{ borderRadius: 2, border: 1, borderColor: "divider" }}
      >
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700, bgcolor: "action.hover" }}>Time</TableCell>
              <TableCell sx={{ fontWeight: 700, bgcolor: "action.hover" }}>Type</TableCell>
              <TableCell sx={{ fontWeight: 700, bgcolor: "action.hover" }}>RFID</TableCell>
              <TableCell sx={{ fontWeight: 700, bgcolor: "action.hover" }}>Plate</TableCell>
              <TableCell sx={{ fontWeight: 700, bgcolor: "action.hover" }}>Detail</TableCell>
              <TableCell sx={{ fontWeight: 700, bgcolor: "action.hover" }}>Employee</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4, color: "text.secondary" }}>
                  No alerts found
                </TableCell>
              </TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.id} hover>
                <TableCell sx={{ whiteSpace: "nowrap", fontSize: 13 }}>
                  {formatDate(r.created_at)}
                </TableCell>
                <TableCell>
                  <Chip
                    label={r.alert_type}
                    size="small"
                    color={TYPE_COLORS[r.alert_type] || "default"}
                    variant="outlined"
                    sx={{ fontWeight: 600, fontSize: 12 }}
                  />
                </TableCell>
                <TableCell sx={{ fontFamily: "monospace", fontSize: 13 }}>
                  {r.rfid_tag || "—"}
                </TableCell>
                <TableCell sx={{ fontFamily: "monospace", fontSize: 13 }}>
                  {r.plate_detected || "—"}
                </TableCell>
                <TableCell sx={{ maxWidth: 280 }}>
                  <Tooltip title={r.detail || ""} placement="top-start">
                    <Typography
                      variant="body2"
                      sx={{
                        fontSize: 13,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        maxWidth: 280,
                      }}
                    >
                      {r.detail || "—"}
                    </Typography>
                  </Tooltip>
                </TableCell>
                <TableCell sx={{ fontSize: 13 }}>
                  {r.employee_id || "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5, display: "block" }}>
        Showing {rows.length} alert{rows.length !== 1 ? "s" : ""}
      </Typography>
    </Box>
  );
}
