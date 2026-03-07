"""
API Agent — FastAPI + WebSocket orchestrator for barricade verification.
Sends events to the dashboard per CONTEXT.MD WebSocket contract.
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI

from api_agent.core import get_manager
from api_agent.routes import router


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    manager = get_manager()
    manager.connections.clear()


app = FastAPI(
    title="Barricade API Agent",
    description="WebSocket orchestrator for RFID, ANPR, Fingerprint verification",
    lifespan=lifespan,
)

app.include_router(router)
