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
  MenuItem,
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

function todayISODate() {
  return new Date().toISOString().slice(0, 10);
}

export function OrdersPage() {
  const { canEdit } = useOutletContext();
  const [rows, setRows] = useState([]);
  const [trucks, setTrucks] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    truck_id: "",
    driver_id: "",
    mine_site_id: "",
    drop_site_id: "",
    goods_type: "coal",
    scheduled_date: todayISODate(),
  });

  async function load() {
    setErr(null);
    setLoading(true);
    try {
      const [o, t, d, s] = await Promise.all([
        apiFetch("/api/orders/"),
        apiFetch("/api/trucks/"),
        apiFetch("/api/drivers/"),
        apiFetch("/api/sites/"),
      ]);
      setRows(o);
      setTrucks(t);
      setDrivers(d);
      setSites(s);
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
      await apiFetch("/api/orders/", {
        method: "POST",
        body: {
          truck_id: form.truck_id,
          driver_id: form.driver_id,
          mine_site_id: form.mine_site_id,
          drop_site_id: form.drop_site_id,
          goods_type: form.goods_type,
          scheduled_date: form.scheduled_date,
        },
      });
      setOpen(false);
      load();
    } catch (e) {
      setErr(e.message);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this order?")) return;
    try {
      await apiFetch(`/api/orders/${id}`, { method: "DELETE" });
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
        <Box>
          <Typography variant="body2" color="text.secondary">
            Active and scheduled gate orders
          </Typography>
        </Box>
        {canEdit && (
          <Button variant="contained" size="medium" onClick={() => setOpen(true)} sx={{ borderRadius: 2 }}>
            New order
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
              <TableCell sx={{ fontWeight: 700, bgcolor: "action.hover" }}>ID</TableCell>
              <TableCell sx={{ fontWeight: 700, bgcolor: "action.hover" }}>Status</TableCell>
              <TableCell sx={{ fontWeight: 700, bgcolor: "action.hover" }}>Date</TableCell>
              <TableCell sx={{ fontWeight: 700, bgcolor: "action.hover" }}>Goods</TableCell>
              <TableCell sx={{ fontWeight: 700, bgcolor: "action.hover" }}>Truck</TableCell>
              <TableCell sx={{ fontWeight: 700, bgcolor: "action.hover" }}>Driver</TableCell>
              {canEdit && (
                <TableCell align="right" sx={{ fontWeight: 700, bgcolor: "action.hover" }}>
                  Actions
                </TableCell>
              )}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r) => {
              const truck = trucks.find((t) => t.id === r.truck_id);
              const driver = drivers.find((d) => d.id === r.driver_id);
              return (
              <TableRow key={r.id} hover>
                <TableCell sx={{ maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis" }}>{r.id}</TableCell>
                <TableCell>{r.status}</TableCell>
                <TableCell>{r.scheduled_date}</TableCell>
                <TableCell>{r.goods_type}</TableCell>
                <TableCell>{truck?.license_plate ?? r.truck_id}</TableCell>
                <TableCell>{driver?.full_name ?? r.driver_id}</TableCell>
                {canEdit && (
                  <TableCell align="right">
                    <Button size="small" color="error" variant="text" onClick={() => handleDelete(r.id)}>
                      Delete
                    </Button>
                  </TableCell>
                )}
              </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>New order</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
          <TextField
            select
            label="Truck"
            value={form.truck_id}
            onChange={(e) => setForm((f) => ({ ...f, truck_id: e.target.value }))}
            fullWidth
          >
            {trucks.map((t) => (
              <MenuItem key={t.id} value={t.id}>
                {t.rfid_tag} — {t.license_plate}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Driver"
            value={form.driver_id}
            onChange={(e) => setForm((f) => ({ ...f, driver_id: e.target.value }))}
            fullWidth
          >
            {drivers.map((d) => (
              <MenuItem key={d.id} value={d.id}>
                {d.full_name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Mine site"
            value={form.mine_site_id}
            onChange={(e) => setForm((f) => ({ ...f, mine_site_id: e.target.value }))}
            fullWidth
          >
            {sites
              .filter((x) => x.site_type === "mine")
              .map((s) => (
                <MenuItem key={s.id} value={s.id}>
                  {s.name}
                </MenuItem>
              ))}
          </TextField>
          <TextField
            select
            label="Drop site"
            value={form.drop_site_id}
            onChange={(e) => setForm((f) => ({ ...f, drop_site_id: e.target.value }))}
            fullWidth
          >
            {sites
              .filter((x) => x.site_type === "drop")
              .map((s) => (
                <MenuItem key={s.id} value={s.id}>
                  {s.name}
                </MenuItem>
              ))}
          </TextField>
          <TextField
            label="Goods type"
            value={form.goods_type}
            onChange={(e) => setForm((f) => ({ ...f, goods_type: e.target.value }))}
            fullWidth
          />
          <TextField
            type="date"
            label="Scheduled date"
            value={form.scheduled_date}
            onChange={(e) => setForm((f) => ({ ...f, scheduled_date: e.target.value }))}
            fullWidth
            InputLabelProps={{ shrink: true }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate} disabled={!form.truck_id || !form.driver_id}>
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
