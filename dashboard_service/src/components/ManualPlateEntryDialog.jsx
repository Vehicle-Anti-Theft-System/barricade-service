import { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
} from "@mui/material";

export function ManualPlateEntryDialog({ open, onClose, onSubmit }) {
  const [plate, setPlate] = useState("");

  const handleSubmit = () => {
    const trimmed = plate.trim().toUpperCase().replace(/\s+/g, "");
    if (trimmed) {
      onSubmit(trimmed);
      setPlate("");
      onClose();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      scroll="body"
      slotProps={{
        backdrop: {
          sx: { backdropFilter: "blur(3px)" },
        },
      }}
    >
      <DialogTitle sx={{ pb: 0.5, fontWeight: 600, letterSpacing: "-0.01em" }}>
        Manual plate entry
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1, fontWeight: 400, lineHeight: 1.5 }}>
          Use when the camera cannot read the plate after retries. Entry is verified against the
          current RFID session.
        </Typography>
      </DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        <TextField
          autoFocus
          fullWidth
          label="License plate"
          value={plate}
          onChange={(e) => setPlate(e.target.value)}
          placeholder="e.g. MH12AB4821"
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button onClick={onClose} color="inherit" variant="text">
          Cancel
        </Button>
        <Button variant="contained" color="primary" onClick={handleSubmit} disabled={!plate.trim()}>
          Submit & verify
        </Button>
      </DialogActions>
    </Dialog>
  );
}
