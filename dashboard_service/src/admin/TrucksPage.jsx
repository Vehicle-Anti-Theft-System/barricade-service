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

export function TrucksPage() {
  const { canEdit } = useOutletContext();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    rfid_tag: "",
    license_plate: "",
    make_model: "",
    owner_name: "",
  });

  async function load() {
    setErr(null);
    setLoading(true);
    try {
      const t = await apiFetch("/api/trucks/");
      setRows(t);
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
      await apiFetch("/api/trucks/", {
        method: "POST",
        body: {
          rfid_tag: form.rfid_tag.trim(),
          license_plate: form.license_plate.trim(),
          make_model: form.make_model.trim() || null,
          owner_name: form.owner_name.trim() || null,
        },
      });
      setOpen(false);
      setForm({ rfid_tag: "", license_plate: "", make_model: "", owner_name: "" });
      load();
    } catch (e) {
      setErr(e.message);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this truck?")) return;
    try {
      await apiFetch(`/api/trucks/${id}`, { method: "DELETE" });
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
          RFID tags and license plates
        </Typography>
        {canEdit && (
          <Button variant="contained" size="medium" onClick={() => setOpen(true)} sx={{ borderRadius: 2 }}>
            New truck
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
              {canEdit && (
                <TableCell sx={{ fontWeight: 700, bgcolor: "action.hover" }}>RFID</TableCell>
              )}
              <TableCell sx={{ fontWeight: 700, bgcolor: "action.hover" }}>Plate</TableCell>
              <TableCell sx={{ fontWeight: 700, bgcolor: "action.hover" }}>Model</TableCell>
              <TableCell sx={{ fontWeight: 700, bgcolor: "action.hover" }}>Owner</TableCell>
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
                {canEdit && <TableCell>{r.rfid_tag}</TableCell>}
                <TableCell>{r.license_plate}</TableCell>
                <TableCell>{r.make_model}</TableCell>
                <TableCell>{r.owner_name}</TableCell>
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
        <DialogTitle>New truck</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
          <TextField
            label="RFID tag"
            value={form.rfid_tag}
            onChange={(e) => setForm((f) => ({ ...f, rfid_tag: e.target.value }))}
            fullWidth
            required
          />
          <TextField
            label="License plate"
            value={form.license_plate}
            onChange={(e) => setForm((f) => ({ ...f, license_plate: e.target.value }))}
            fullWidth
            required
          />
          <TextField
            label="Make / model"
            value={form.make_model}
            onChange={(e) => setForm((f) => ({ ...f, make_model: e.target.value }))}
            fullWidth
          />
          <TextField
            label="Owner"
            value={form.owner_name}
            onChange={(e) => setForm((f) => ({ ...f, owner_name: e.target.value }))}
            fullWidth
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={!form.rfid_tag.trim() || !form.license_plate.trim()}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
