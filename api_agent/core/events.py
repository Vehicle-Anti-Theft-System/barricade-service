"""
Event and command names for WebSocket protocol.
Must match dashboard useVerificationState.js reducer (CONTEXT.MD).
"""

# Outbound: API Agent → Dashboard
EVENT_RFID_SCANNING = "rfid_scanning"
EVENT_RFID_CHECK_RESULT = "rfid_check_result"
EVENT_ANPR_PROCESSING = "anpr_processing"
EVENT_ANPR_RESULT = "anpr_result"
EVENT_ANPR_RETRY = "anpr_retry"
EVENT_ANPR_MANUAL = "anpr_manual"
EVENT_GATE_DECISION = "gate_decision"
EVENT_ALERT_RAISED = "alert_raised"
EVENT_SESSION_RESET = "session_reset"
EVENT_BACKEND_HEALTH = "backend_health"

# Inbound: Dashboard → API Agent
CMD_SIMULATE = "simulate"
CMD_START_VERIFICATION = "start_verification"
CMD_SESSION_RESET = "session_reset"
CMD_MANUAL_PLATE = "manual_plate"
CMD_OPEN_GATE = "open_gate"
CMD_SET_AUTO_OPEN = "set_auto_open"
