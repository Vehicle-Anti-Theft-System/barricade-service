"""
Pass-through proxy for browser → backend /api/* calls.

The dashboard never talks to the backend directly. It hits this agent on the
same /api/* paths and we forward to BACKEND_BASE_URL, passing the browser's
Authorization: Bearer header through unchanged. The backend's GateAuthMiddleware
still enforces JWT auth and role-based access control per user.

/api/verify/* is blocked here: those routes require X-API-Key and are only
called by the agent itself via services/backend_client.py.
"""
from __future__ import annotations

import logging

import httpx
from fastapi import APIRouter, HTTPException, Request, Response

from api_agent.config import backend_base_url, backend_http_timeout_sec

logger = logging.getLogger(__name__)

router = APIRouter()

_HOP_BY_HOP = {
    "host",
    "content-length",
    "connection",
    "keep-alive",
    "transfer-encoding",
    "te",
    "upgrade",
    "proxy-authorization",
    "proxy-authenticate",
    "trailer",
    "content-encoding",
}


@router.api_route(
    "/api/{path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    include_in_schema=False,
)
async def proxy_api(path: str, request: Request) -> Response:
    if path == "verify" or path.startswith("verify/"):
        raise HTTPException(status_code=404, detail="Not Found")

    url = f"{backend_base_url()}/api/{path}"
    if request.url.query:
        url = f"{url}?{request.url.query}"

    fwd_headers = {
        k: v for k, v in request.headers.items() if k.lower() not in _HOP_BY_HOP
    }

    body = await request.body()

    try:
        async with httpx.AsyncClient(timeout=backend_http_timeout_sec()) as client:
            upstream = await client.request(
                method=request.method,
                url=url,
                content=body if body else None,
                headers=fwd_headers,
            )
    except httpx.RequestError as exc:
        logger.warning(
            "Proxy %s /api/%s transport error: %s", request.method, path, exc
        )
        raise HTTPException(
            status_code=502, detail="Upstream backend unreachable"
        ) from exc

    resp_headers = {
        k: v for k, v in upstream.headers.items() if k.lower() not in _HOP_BY_HOP
    }
    return Response(
        content=upstream.content,
        status_code=upstream.status_code,
        headers=resp_headers,
        media_type=upstream.headers.get("content-type"),
    )
