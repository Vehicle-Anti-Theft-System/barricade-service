"""
Serial RFID reader — reads tag ids from an Arduino (or compatible USB serial
device) and pushes each one to the API Agent.

Arduino sketch contract (keep this exact):
    - One tag per line, terminated with newline (`Serial.println(tag)`).
    - Arduino handles any debounce / duplicate suppression so this reader
      forwards every line it receives without its own anti-spam layer.

The reader runs on a daemon thread (pyserial is blocking) and reconnects on
failure with a small backoff. If no explicit port is configured it attempts
to auto-detect by USB VID (Arduino / CH340 / FTDI / CP210x).
"""
from __future__ import annotations

import logging
import threading
import time
from typing import Optional

import serial
from serial.tools import list_ports

from rfid_service.config import (
    config_file_path,
    rfid_baud_rate,
    rfid_mode,
    rfid_serial_port,
)
from rfid_service.push import push_rfid_tag

logger = logging.getLogger(__name__)

# Common USB VIDs for Arduino Uno and compatible boards / USB-serial bridges.
_ARDUINO_USB_VIDS = {
    0x2341,  # Arduino SA (genuine Uno)
    0x2A03,  # Arduino LLC
    0x1A86,  # QinHeng CH340/CH341 (common Uno clones)
    0x0403,  # FTDI
    0x10C4,  # Silicon Labs CP210x
}

_RECONNECT_DELAY_SEC = 3.0
_NO_PORT_DELAY_SEC = 5.0
_MODE_IDLE_DELAY_SEC = 2.0
# Arduino auto-resets when the serial port opens; wait for its bootloader.
_POST_OPEN_SETTLE_SEC = 1.5


def _config_mtime() -> float:
    """Return mtime of barricade_config.json, or 0.0 if unavailable."""
    p = config_file_path()
    if p is None:
        return 0.0
    try:
        return p.stat().st_mtime
    except OSError:
        return 0.0


def _auto_detect_port() -> Optional[str]:
    for p in list_ports.comports():
        if p.vid in _ARDUINO_USB_VIDS:
            logger.info(
                "Auto-detected serial port %s (vid=0x%04x pid=0x%04x desc=%s)",
                p.device,
                p.vid,
                p.pid or 0,
                p.description,
            )
            return p.device
    return None


class SerialReader:
    def __init__(self) -> None:
        self._thread: Optional[threading.Thread] = None
        self._stop = threading.Event()
        self._port: Optional[str] = None
        self._connected = False
        self._last_error: Optional[str] = None
        self._ser: Optional[serial.Serial] = None
        self._write_lock = threading.Lock()

    def start(self) -> None:
        if self._thread and self._thread.is_alive():
            return
        self._stop.clear()
        self._thread = threading.Thread(
            target=self._run, name="rfid-serial-reader", daemon=True
        )
        self._thread.start()
        logger.info("RFID serial reader thread started")

    def stop(self) -> None:
        self._stop.set()
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=2.0)
            logger.info("RFID serial reader thread stopped")

    def status(self) -> dict:
        return {
            "port": self._port,
            "connected": self._connected,
            "last_error": self._last_error,
        }

    def send_command(self, line: str) -> bool:
        """Write a newline-terminated command to the open serial port.

        Thread-safe with the reader loop (pyserial serializes concurrent read/write
        on the same handle; this extra lock prevents interleaving multiple writes).
        Returns True if the bytes were handed to the OS, False if the port is
        currently not open.
        """
        payload = (line.rstrip("\r\n") + "\n").encode("ascii", errors="replace")
        with self._write_lock:
            ser = self._ser
            if ser is None or not ser.is_open:
                logger.warning(
                    "send_command: serial port not open; command=%r dropped", line
                )
                return False
            try:
                ser.write(payload)
                ser.flush()
                logger.info("send_command: wrote %r to %s", line, self._port)
                return True
            except serial.SerialException as exc:
                logger.warning(
                    "send_command: write failed on %s: %s", self._port, exc
                )
                return False

    def _run(self) -> None:
        while not self._stop.is_set():
            # Honor mode changes from the dashboard — only connect when mode is 'serial'.
            if rfid_mode() != "serial":
                if self._last_error != "mode_not_serial":
                    logger.info("RFID mode is not 'serial'; reader idling until config change")
                    self._last_error = "mode_not_serial"
                self._port = None
                self._connected = False
                self._stop.wait(_MODE_IDLE_DELAY_SEC)
                continue

            port = rfid_serial_port() or _auto_detect_port()
            if not port:
                if self._last_error != "no_port":
                    logger.warning(
                        "RFID serial reader: no port configured and none auto-detected "
                        "(set rfid.com_port in barricade_config.json or RFID_SERIAL_PORT env). "
                        "Retrying every %ss.",
                        _NO_PORT_DELAY_SEC,
                    )
                self._port = None
                self._connected = False
                self._last_error = "no_port"
                self._stop.wait(_NO_PORT_DELAY_SEC)
                continue

            self._port = port
            baud = rfid_baud_rate()
            connection_mtime = _config_mtime()
            try:
                with serial.Serial(port, baud, timeout=1.0) as ser:
                    self._ser = ser
                    logger.info(
                        "RFID serial reader connected port=%s baud=%s", port, baud
                    )
                    self._connected = True
                    self._last_error = None
                    time.sleep(_POST_OPEN_SETTLE_SEC)
                    try:
                        ser.reset_input_buffer()
                    except serial.SerialException:
                        pass
                    try:
                        self._read_loop(ser, connection_mtime)
                    finally:
                        self._ser = None
                        self._connected = False
            except serial.SerialException as exc:
                self._connected = False
                self._ser = None
                self._last_error = f"serial_exception: {exc}"
                logger.warning(
                    "RFID serial reader error on %s: %s; retrying in %ss",
                    port,
                    exc,
                    _RECONNECT_DELAY_SEC,
                )
                self._stop.wait(_RECONNECT_DELAY_SEC)

    def _read_loop(self, ser: serial.Serial, connection_mtime: float) -> None:
        while not self._stop.is_set():
            line = ser.readline()  # blocks up to timeout
            if not line:
                # readline timeout — good moment to check for a config change
                if _config_mtime() != connection_mtime:
                    logger.info(
                        "barricade_config.json changed; reconnecting to pick up new RFID settings"
                    )
                    return
                continue
            decoded = line.decode("utf-8", errors="replace").strip()
            if not decoded:
                continue
            # Status messages from the sketch (SYSTEM_READY, GATE_OPENED, …).
            # Logged for visibility but NOT forwarded as an RFID tag.
            if decoded.startswith("EVT:"):
                logger.info("Arduino event: %s", decoded[4:])
                continue
            tag = decoded
            logger.info("RFID serial read tag=%s", tag)
            ok, _body, status = push_rfid_tag(tag)
            if not ok:
                logger.warning(
                    "RFID serial ingest non-success tag=%s http_status=%s",
                    tag,
                    status,
                )


reader = SerialReader()
