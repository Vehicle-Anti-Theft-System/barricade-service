import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { useOutletContext } from "react-router-dom";
import { apiFetch } from "../hooks/useBackendApi";

export function DriversPage() {
  const { canEdit } = useOutletContext();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    aadhar_number: "",
    phone_number: "",
  });

  async function load() {
    setErr(null);
    setLoading(true);
    try {
      const d = await apiFetch("/api/drivers/");
      setRows(d);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate() {
    try {
      await apiFetch("/api/drivers/", {
        method: "POST",
        body: {
          full_name: form.full_name.trim(),
          aadhar_number: form.aadhar_number.trim(),
          phone_number: form.phone_number.trim() || null,
        },
      });
      setOpen(false);
      setForm({ full_name: "", aadhar_number: "", phone_number: "" });
      load();
    } catch (e) {
      setErr(e.message);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this driver?")) return;
    try {
      await apiFetch(`/api/drivers/${id}`, { method: "DELETE" });
      load();
    } catch (e) {
      setErr(e.message);
    }
  }

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
          Driver registry
        </Typography>
        {canEdit && (
          <Button variant="contained" size="medium" onClick={() => setOpen(true)} sx={{ borderRadius: 2 }}>
            New driver
          </Button>
        )}
      </Box>
      {err && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setErr(null)}>
          {err}
        </Alert>
      )}
      <TableContainer
        component={Paper}
        elevation={0}
        sx={{ borderRadius: 2, border: 1, borderColor: "divider" }}
      >
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700, bgcolor: "action.hover" }}>Name</TableCell>
              <TableCell sx={{ fontWeight: 700, bgcolor: "action.hover" }}>Aadhar</TableCell>
              <TableCell sx={{ fontWeight: 700, bgcolor: "action.hover" }}>Phone</TableCell>
              <TableCell sx={{ fontWeight: 700, bgcolor: "action.hover" }}>Active</TableCell>
              {canEdit && (
                <TableCell align="right" sx={{ fontWeight: 700, bgcolor: "action.hover" }}>
                  Actions
                </TableCell>
              )}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id} hover>
                <TableCell>{r.full_name}</TableCell>
                <TableCell>{r.aadhar_number}</TableCell>
                <TableCell>{r.phone_number}</TableCell>
                <TableCell>{r.is_active ? "Yes" : "No"}</TableCell>
                {canEdit && (
                  <TableCell align="right">
                    <Button size="small" color="error" variant="text" onClick={() => handleDelete(r.id)}>
                      Delete
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>New driver</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
          <TextField
            label="Full name"
            value={form.full_name}
            onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
            fullWidth
            required
          />
          <TextField
            label="Aadhar number"
            value={form.aadhar_number}
            onChange={(e) => setForm((f) => ({ ...f, aadhar_number: e.target.value }))}
            fullWidth
            required
          />
          <TextField
            label="Phone"
            value={form.phone_number}
            onChange={(e) => setForm((f) => ({ ...f, phone_number: e.target.value }))}
            fullWidth
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={!form.full_name.trim() || !form.aadhar_number.trim()}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
