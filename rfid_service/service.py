"""In-memory mock: cycles tag strings (Arduino will replace this with serial reads)."""

from __future__ import annotations

import logging

from rfid_service.mock_data import MOCK_RFID_TAGS

logger = logging.getLogger(__name__)


class MockRFIDQueue:
    def __init__(self) -> None:
        self._index = 0

    def next_tag(self) -> str:
        if not MOCK_RFID_TAGS:
            logger.warning("MOCK_RFID_TAGS is empty; returning UNKNOWN")
            return "UNKNOWN"
        tag = MOCK_RFID_TAGS[self._index]
        self._index = (self._index + 1) % len(MOCK_RFID_TAGS)
        logger.debug(
            "Mock queue next tag=%s (index after advance=%s/%s)",
            tag,
            self._index,
            len(MOCK_RFID_TAGS),
        )
        return tag

    def reset(self) -> None:
        self._index = 0
        logger.info("Mock RFID queue reset")


mock_rfid_queue = MockRFIDQueue()
