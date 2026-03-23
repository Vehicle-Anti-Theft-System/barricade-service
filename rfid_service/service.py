"""In-memory mock: cycles tag strings (Arduino will replace this with serial reads)."""

from __future__ import annotations

from rfid_service.mock_data import MOCK_RFID_TAGS


class MockRFIDQueue:
    def __init__(self) -> None:
        self._index = 0

    def next_tag(self) -> str:
        if not MOCK_RFID_TAGS:
            return "UNKNOWN"
        tag = MOCK_RFID_TAGS[self._index]
        self._index = (self._index + 1) % len(MOCK_RFID_TAGS)
        return tag

    def reset(self) -> None:
        self._index = 0


mock_rfid_queue = MockRFIDQueue()
