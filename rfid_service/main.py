"""Run RFID mock service."""

import uvicorn

from rfid_service.logging_config import configure_logging


def main() -> None:
    configure_logging()
    uvicorn.run("rfid_service.app:app", host="0.0.0.0", port=8002, reload=True)


if __name__ == "__main__":
    main()
