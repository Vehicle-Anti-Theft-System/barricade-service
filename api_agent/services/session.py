"""
Per-barricade verification session state.

Tracks RFID → ANPR pipeline context so that follow-up commands
(manual_plate, open_gate) can reference the current session's rfid_tag, order_id, etc.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class VerificationSession:
    rfid_tag: str | None = None
    expected_plate: str | None = None
    order_id: str | None = None
    truck_id: str | None = None
    driver_name: str | None = None
    plate_detected: str | None = None
    anpr_validated: bool = False
    rfid_validated: bool = False

    def reset(self) -> None:
        logger.debug("Session reset (clearing verification context)")
        self.rfid_tag = None
        self.expected_plate = None
        self.order_id = None
        self.truck_id = None
        self.driver_name = None
        self.plate_detected = None
        self.anpr_validated = False
        self.rfid_validated = False

    def set_rfid_result(self, data: dict) -> None:
        self.rfid_tag = data.get("rfid_tag")
        self.expected_plate = data.get("expected_plate")
        self.order_id = str(data["order_id"]) if data.get("order_id") else None
        self.truck_id = str(data["truck_id"]) if data.get("truck_id") else None
        self.driver_name = data.get("driver_name")
        self.rfid_validated = data.get("status") == "VALIDATED"
        logger.info(
            "Session updated from RFID: status=%s rfid_tag=%s order_id=%s truck_id=%s",
            data.get("status"),
            self.rfid_tag,
            self.order_id,
            self.truck_id,
        )


_session = VerificationSession()


def get_session() -> VerificationSession:
    return _session
