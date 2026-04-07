import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  CircularProgress,
  Divider,
  FormControl,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import VideocamOutlinedIcon from "@mui/icons-material/VideocamOutlined";
import UsbOutlinedIcon from "@mui/icons-material/UsbOutlined";
import { alpha } from "@mui/material/styles";

const API_AGENT =
  `http://${import.meta.env.VITE_API_AGENT_HOST || "localhost:8080"}`;

const COMMON_BAUD = [300, 1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200];

async function fetchConfig() {
  const res = await fetch(`${API_AGENT}/config`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

async function saveConfig(data) {
  const res = await fetch(`${API_AGENT}/config`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.detail || `${res.status} ${res.statusText}`);
  }
  return body;
}

function SectionCard({ icon, title, subtitle, children }) {
  return (
    <Card
      variant="outlined"
      sx={{
        borderRadius: 2.5,
        overflow: "visible",
        "&:hover": { borderColor: "primary.main", boxShadow: (t) => `0 0 0 1px ${t.palette.primary.main}` },
        transition: "border-color .2s, box-shadow .2s",
      }}
    >
      <CardHeader
        avatar={
          <Box
            sx={{
              width: 40,
              height: 40,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 2,
              bgcolor: (t) => alpha(t.palette.primary.main, 0.1),
              color: "primary.main",
            }}
          >
            {icon}
          </Box>
        }
        title={
          <Typography variant="subtitle1" fontWeight={700}>
            {title}
          </Typography>
        }
        subheader={
          <Typography variant="body2" color="text.secondary">
            {subtitle}
          </Typography>
        }
        sx={{ pb: 0 }}
      />
      <CardContent sx={{ pt: 2 }}>{children}</CardContent>
    </Card>
  );
}

export function ConfigurationPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const [toast, setToast] = useState("");
  const [camera, setCamera] = useState({
    type: "usb",
    usb_index: 0,
    network_url: "",
    resolution_width: 1280,
    resolution_height: 720,
  });
  const [rfid, setRfid] = useState({
    mode: "mock",
    com_port: "",
    baud_rate: 9600,
    api_agent_ingest_url: "http://localhost:8080/rfid/scan",
  });

  useEffect(() => {
    setErr(null);
    fetchConfig()
      .then((d) => {
        if (d.camera) setCamera(d.camera);
        if (d.rfid) setRfid(d.rfid);
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    setErr(null);
    try {
      const result = await saveConfig({ camera, rfid });
      if (result.camera) setCamera(result.camera);
      if (result.rfid) setRfid(result.rfid);
      setToast("Configuration saved");
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={200}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 720 }}>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={3} flexWrap="wrap" gap={1}>
        <Box>
          <Typography variant="body2" color="text.secondary">
            Edge device hardware settings. Changes take effect after service restart.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <SaveOutlinedIcon />}
          onClick={handleSave}
          disabled={saving}
          sx={{ borderRadius: 2, textTransform: "none", fontWeight: 600, px: 3 }}
        >
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </Box>

      {err && (
        <Alert severity="error" sx={{ mb: 2.5, borderRadius: 2 }} onClose={() => setErr(null)}>
          {err}
        </Alert>
      )}

      <Stack spacing={3}>
        {/* ── Camera ──────────────────────────────────── */}
        <SectionCard
          icon={<VideocamOutlinedIcon fontSize="small" />}
          title="Camera"
          subtitle="Configure the ANPR camera source"
        >
          <Stack spacing={2.5}>
            <FormControl fullWidth size="small">
              <InputLabel>Camera type</InputLabel>
              <Select
                label="Camera type"
                value={camera.type}
                onChange={(e) => setCamera((c) => ({ ...c, type: e.target.value }))}
              >
                <MenuItem value="usb">USB / Built-in webcam</MenuItem>
                <MenuItem value="network">Network / IP camera (RTSP or HTTP)</MenuItem>
              </Select>
              <FormHelperText>
                {camera.type === "usb"
                  ? "Uses OpenCV VideoCapture with a device index"
                  : "Provide the full RTSP or HTTP MJPEG stream URL"}
              </FormHelperText>
            </FormControl>

            {camera.type === "usb" && (
              <TextField
                label="USB device index"
                type="number"
                size="small"
                fullWidth
                value={camera.usb_index}
                onChange={(e) =>
                  setCamera((c) => ({ ...c, usb_index: Math.max(0, Number(e.target.value)) }))
                }
                helperText="Usually 0 for the first camera, 1 for a second, etc."
                inputProps={{ min: 0, max: 20 }}
              />
            )}

            {camera.type === "network" && (
              <TextField
                label="Stream URL"
                size="small"
                fullWidth
                value={camera.network_url}
                onChange={(e) => setCamera((c) => ({ ...c, network_url: e.target.value }))}
                placeholder="rtsp://192.168.1.100:554/stream1"
                helperText="RTSP or HTTP MJPEG URL of the IP camera"
              />
            )}

            <Divider textAlign="left">
              <Typography variant="caption" color="text.secondary">
                Resolution
              </Typography>
            </Divider>

            <Box display="flex" gap={2}>
              <TextField
                label="Width"
                type="number"
                size="small"
                fullWidth
                value={camera.resolution_width}
                onChange={(e) =>
                  setCamera((c) => ({ ...c, resolution_width: Number(e.target.value) }))
                }
                inputProps={{ min: 320, max: 3840, step: 10 }}
              />
              <TextField
                label="Height"
                type="number"
                size="small"
                fullWidth
                value={camera.resolution_height}
                onChange={(e) =>
                  setCamera((c) => ({ ...c, resolution_height: Number(e.target.value) }))
                }
                inputProps={{ min: 240, max: 2160, step: 10 }}
              />
            </Box>
          </Stack>
        </SectionCard>

        {/* ── RFID ────────────────────────────────────── */}
        <SectionCard
          icon={<UsbOutlinedIcon fontSize="small" />}
          title="RFID Reader"
          subtitle="Serial port settings for the RFID hardware"
        >
          <Stack spacing={2.5}>
            <FormControl fullWidth size="small">
              <InputLabel>RFID mode</InputLabel>
              <Select
                label="RFID mode"
                value={rfid.mode}
                onChange={(e) => setRfid((r) => ({ ...r, mode: e.target.value }))}
              >
                <MenuItem value="mock">Mock (simulated tags for development)</MenuItem>
                <MenuItem value="serial">Serial (real hardware reader)</MenuItem>
              </Select>
              <FormHelperText>
                {rfid.mode === "mock"
                  ? "Cycles through seeded test tags — no hardware needed"
                  : "Reads tags from a physical RFID reader via serial port"}
              </FormHelperText>
            </FormControl>

            {rfid.mode === "serial" && (
              <>
                <TextField
                  label="COM / Serial port"
                  size="small"
                  fullWidth
                  value={rfid.com_port}
                  onChange={(e) => setRfid((r) => ({ ...r, com_port: e.target.value }))}
                  placeholder={
                    navigator.userAgent.includes("Win")
                      ? "COM3"
                      : "/dev/ttyUSB0"
                  }
                  helperText="Windows: COM3, COM4 … | Linux: /dev/ttyUSB0 | macOS: /dev/cu.usbserial-…"
                />
                <FormControl fullWidth size="small">
                  <InputLabel>Baud rate</InputLabel>
                  <Select
                    label="Baud rate"
                    value={rfid.baud_rate}
                    onChange={(e) => setRfid((r) => ({ ...r, baud_rate: Number(e.target.value) }))}
                  >
                    {COMMON_BAUD.map((b) => (
                      <MenuItem key={b} value={b}>
                        {b.toLocaleString()}
                      </MenuItem>
                    ))}
                  </Select>
                  <FormHelperText>Match the baud rate configured on your RFID reader</FormHelperText>
                </FormControl>
              </>
            )}

          </Stack>
        </SectionCard>
      </Stack>

      <Snackbar
        open={!!toast}
        autoHideDuration={3000}
        onClose={() => setToast("")}
        message={toast}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </Box>
  );
}
