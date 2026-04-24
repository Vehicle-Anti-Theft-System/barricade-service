# RFID Service

Reads RFID tag ids (from an Arduino over USB serial, or a mock cycle) and pushes them to the barricade **API Agent**. **Flow is unidirectional:** this service **only sends** `{ "rfid_tag": "<string>" }` to `POST /rfid/scan` on the agent. It does **not** fetch configuration or verification data back. Guards see outcomes on the **dashboard** (WebSocket from the API Agent).

Two modes, selected at startup:

| Mode | Source of tags |
|------|----------------|
| **`serial`** | Arduino (or any USB-serial device) prints one tag per line. Python reads the line, pushes to the agent. Arduino firmware is responsible for debounce / duplicate suppression. |
| **`mock`** | `POST /trigger` (or the `/ui` button) cycles a built-in list of seed tags. No hardware required. |

## Configuration

Precedence: **env var > `barricade_config.json` (`rfid.*` block) > built-in default**.

| Env | `barricade_config.json` | Default | Purpose |
|-----|------------------------|---------|---------|
| `RFID_MODE` | `rfid.mode` | `mock` | `serial` for Arduino, `mock` for the dev trigger UI |
| `RFID_SERIAL_PORT` | `rfid.com_port` | *(auto-detect)* | Device path. macOS: `/dev/cu.usbmodem...` or `/dev/cu.usbserial-...`. Leave blank to auto-detect by USB VID (Arduino / CH340 / FTDI / CP210x). |
| `RFID_BAUD_RATE` | `rfid.baud_rate` | `9600` | Must match the Arduino sketch's `Serial.begin(...)` |
| `API_AGENT_RFID_INGEST_URL` | `rfid.api_agent_ingest_url` | `http://localhost:8080/rfid/scan` | Full URL for `POST` body `{ "rfid_tag": "..." }` |
| `LOG_LEVEL` | — | `INFO` | Python logging: `DEBUG`, `INFO`, `WARNING`, `ERROR` |

Barricade identity for backend verification is configured on the **API Agent** (`DEFAULT_BARRICADE_ID`), not sent by the RFID service.

## Serial protocol (Arduino ↔ Python)

One USB-serial link, one baud rate, bidirectional ASCII lines terminated by `\n`.

### Arduino → Python

| Line | Meaning | Python behavior |
|------|---------|-----------------|
| `<tag>` (any non-prefixed line) | RFID tag ID | forwarded to API Agent `POST /rfid/scan` as `{ "rfid_tag": "<tag>" }` |
| `EVT:SYSTEM_READY` | Board booted / sketch initialized | logged at INFO, not forwarded |
| `EVT:GATE_OPENED` | Servo moved to open | logged at INFO, not forwarded |
| `EVT:GATE_CLOSED` | Servo moved to closed | logged at INFO, not forwarded |
| anything else starting with `EVT:` | future sketch events | logged at INFO, not forwarded |

**Tag lines must not start with `EVT:`**. Everything else is treated as a tag and pushed to the backend, so spurious debug prints will land in your `alerts` collection as `rfid_unknown`.

### Python → Arduino

| Line | Sent when | Arduino behavior |
|------|-----------|-------------------|
| `open_gate` | `POST /gate/open` on this service fires — triggered by the API Agent after a successful RFID + ANPR verification (auto flow) or an operator clicking "Open Barricade" | `openGate()`: servo to 90°, LED green, prints `EVT:GATE_OPENED`; auto-closes after `REMOVE_TIMEOUT` ms once no card is seen |

**Gate close is Arduino-driven.** Python never sends a close command; the sketch auto-closes `REMOVE_TIMEOUT` ms after the card leaves (or after the `open_gate` command if no card is present). Tune `REMOVE_TIMEOUT` in the sketch to match how long a truck needs to clear the barrier.

### Reference sketch

See `gate_control_script.ino` at the project root for the matching implementation (MFRC522 RFID reader + NeoPixel status LED + servo gate). The status lines in that sketch use the `EVT:` prefix to stay out of the RFID stream.

## Run

From `barricade-service/`:

```bash
uv sync
# Serial mode (Arduino plugged in):
RFID_MODE=serial RFID_SERIAL_PORT=/dev/cu.usbmodem14201 uv run rfid-service

# Mock mode (no hardware):
uv run rfid-service
```

Ensure the **API Agent** is listening on port **8080** (or point `API_AGENT_RFID_INGEST_URL` at it).

When `./run-barricade.sh` starts all services together, set the three `RFID_*` vars in `barricade-service/.env` so serial mode turns on automatically.

## Run

From `barricade-service/`:

```bash
uv sync
uv run uvicorn rfid_service.app:app --host 0.0.0.0 --port 8002
```

or:

```bash
uv run rfid-service
```

Ensure the **API Agent** is listening on port **8080** (or point `API_AGENT_RFID_INGEST_URL` at it).

## Endpoints

- `GET /health` — service health. Includes `serial.port`, `serial.connected`, `serial.last_error`.
- `GET /ui` — HTML page with **Simulate RFID scan** (POSTs to `/trigger`)
- `POST /trigger` — cycles a mock tag string, **POSTs only `rfid_tag` to the API Agent**, returns HTTP transport result (not business verification). Works in both modes — handy for testing the agent without touching the Arduino.
- `POST /gate/open` — writes `OPEN\n` to the open serial port. Called by the API Agent after a verified gate-open decision. Returns 503 if no serial device is connected.

There are no `/scan/next`, `/peek`, or list endpoints — the RFID layer does not expose a pull API for the agent.

## Mock tags

Edit `mock_data.py` (`MOCK_RFID_TAGS`) to change cycled tag strings.

## Serial troubleshooting (macOS)

- **No port detected:** `ls /dev/cu.*` to list candidates; plug the Arduino and the file appears. Set `RFID_SERIAL_PORT` to that exact path.
- **Port opens but no tags:** confirm baud rate matches the sketch; open the Arduino IDE serial monitor at the same baud to verify the device actually prints tag lines.
- **"Resource busy":** another process (often the Arduino IDE serial monitor) has the port open. Close it and restart the RFID service.
- **Arduino resets on open:** this is normal — the reader waits ~1.5 s before the first read so the bootloader can settle.
