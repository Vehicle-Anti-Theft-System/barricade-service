import { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
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
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Manual Plate Entry</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          label="License Plate Number"
          value={plate}
          onChange={(e) => setPlate(e.target.value)}
          placeholder="e.g. MH12AB4821"
          sx={{ mt: 1 }}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={!plate.trim()}>
          Submit
        </Button>
      </DialogActions>
    </Dialog>
  );
}
