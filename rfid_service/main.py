"""Run RFID mock service."""

import uvicorn


def main() -> None:
    uvicorn.run("rfid_service.app:app", host="0.0.0.0", port=8002, reload=True)


if __name__ == "__main__":
    main()
