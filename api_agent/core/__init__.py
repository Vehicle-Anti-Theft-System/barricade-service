"""Core components: events, connection management."""
from api_agent.core.events import (
    CMD_MANUAL_PLATE,
    CMD_OPEN_GATE,
    CMD_SESSION_RESET,
    CMD_SIMULATE,
    CMD_START_VERIFICATION,
    EVENT_ALERT_RAISED,
    EVENT_ANPR_MANUAL,
    EVENT_ANPR_PROCESSING,
    EVENT_ANPR_RESULT,
    EVENT_ANPR_RETRY,
    EVENT_GATE_DECISION,
    EVENT_RFID_CHECK_RESULT,
    EVENT_RFID_SCANNING,
    EVENT_SESSION_RESET,
)
from api_agent.core.connection import ConnectionManager, get_manager

__all__ = [
    "ConnectionManager",
    "get_manager",
    "CMD_MANUAL_PLATE",
    "CMD_OPEN_GATE",
    "CMD_SESSION_RESET",
    "CMD_SIMULATE",
    "CMD_START_VERIFICATION",
    "EVENT_ALERT_RAISED",
    "EVENT_ANPR_MANUAL",
    "EVENT_ANPR_PROCESSING",
    "EVENT_ANPR_RESULT",
    "EVENT_ANPR_RETRY",
    "EVENT_GATE_DECISION",
    "EVENT_RFID_CHECK_RESULT",
    "EVENT_RFID_SCANNING",
    "EVENT_SESSION_RESET",
]
