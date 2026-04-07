"""
API Agent — FastAPI + WebSocket orchestrator for barricade verification.
Sends events to the dashboard per CONTEXT.MD WebSocket contract.
"""
import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api_agent.config import backend_api_key, log_effective_settings
from api_agent.core import get_manager
from api_agent.logging_config import configure_logging
from api_agent.routes import router
from api_agent.services.backend_health import backend_health_loop

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging()
    logger.info("API Agent starting (WebSocket + HTTP)")
    log_effective_settings()
    if not backend_api_key():
        logger.warning(
            "BACKEND_API_KEY is unset — central backend requires X-API-Key on all /api/* calls; "
            "set BACKEND_API_KEY to match backend API_KEY or verification will fail with 401."
        )
    health_task = asyncio.create_task(backend_health_loop())
    yield
    health_task.cancel()
    try:
        await health_task
    except asyncio.CancelledError:
        pass
    manager = get_manager()
    n = len(manager.connections)
    manager.connections.clear()
    logger.info("API Agent shutdown (cleared %d WebSocket connection(s))", n)


app = FastAPI(
    title="Barricade API Agent",
    description="WebSocket orchestrator for RFID + ANPR (2-factor) verification",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)
