"""Run the API Agent WebSocket server."""
import logging

import uvicorn

from api_agent.app import app
from api_agent.logging_config import configure_logging

logger = logging.getLogger(__name__)


def main() -> None:
    configure_logging()
    logger.info("Binding API Agent to http://0.0.0.0:8080 (docs /docs, WebSocket /ws)")
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8080,
        log_level="info",
        access_log=False,
    )


if __name__ == "__main__":
    main()
