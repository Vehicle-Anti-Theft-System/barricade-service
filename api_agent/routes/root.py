"""Root and API info."""
from fastapi import APIRouter

router = APIRouter()


@router.get("/")
def root() -> dict:
    return {
        "service": "Barricade API Agent",
        "docs": "/docs",
        "health": "/health",
        "ws": "ws://localhost:8080/ws",
    }
