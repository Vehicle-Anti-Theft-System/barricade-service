"""
HTTP client for central backend — retries, timeouts, API key, JSON helpers.

Used by RFID ingest and live ANPR / gate-open flows. Keeps behavior consistent
and resilient to brief network or ALB blips (502/503/504).
"""
from __future__ import annotations

import asyncio
import logging
import time
import uuid
from typing import Any

import httpx

from api_agent.config import (
    backend_api_key,
    backend_base_url,
    backend_http_timeout_sec,
    backend_max_retries,
    backend_retry_backoff_sec,
)

logger = logging.getLogger(__name__)


class BackendRequestError(Exception):
    """Non-retryable HTTP error or exhausted retries."""

    def __init__(
        self,
        message: str,
        *,
        status_code: int | None = None,
        body: Any = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.body = body


def _default_headers() -> dict[str, str]:
    h: dict[str, str] = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "X-Request-ID": str(uuid.uuid4()),
    }
    key = backend_api_key()
    if key:
        h["X-API-Key"] = key
    return h


def _should_retry_status(code: int) -> bool:
    return code in (502, 503, 504)


async def backend_post_json(path: str, payload: dict[str, Any]) -> dict[str, Any]:
    """
    POST JSON to backend path (e.g. /api/verify/rfid). Returns parsed JSON object.
    Retries on connection errors and 502/503/504. Raises BackendRequestError on failure.
    """
    url = f"{backend_base_url()}{path}"
    timeout = httpx.Timeout(
        backend_http_timeout_sec(),
        connect=min(10.0, backend_http_timeout_sec()),
    )
    headers = _default_headers()
    req_id = headers.get("X-Request-ID", "")
    last_error: Exception | None = None
    overall_t0 = time.monotonic()

    for attempt in range(1, backend_max_retries() + 1):
        attempt_t0 = time.monotonic()
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                resp = await client.post(url, json=payload, headers=headers)
        except httpx.RequestError as exc:
            last_error = exc
            logger.warning(
                "Backend POST %s attempt %s/%s transport error: %s",
                path,
                attempt,
                backend_max_retries(),
                exc,
            )
            if attempt < backend_max_retries():
                await asyncio.sleep(backend_retry_backoff_sec() * (2 ** (attempt - 1)))
            continue

        if resp.status_code == 401:
            logger.error(
                "Backend POST %s HTTP 401 — check BACKEND_API_KEY matches server API_KEY (request_id=%s)",
                path,
                req_id,
            )
            raise BackendRequestError(
                "Backend rejected API key (401)",
                status_code=401,
                body=_safe_json(resp),
            )

        if _should_retry_status(resp.status_code) and attempt < backend_max_retries():
            elapsed_ms = (time.monotonic() - attempt_t0) * 1000
            logger.warning(
                "Backend POST %s attempt %s/%s: HTTP %s in %.0fms — retrying (request_id=%s)",
                path,
                attempt,
                backend_max_retries(),
                resp.status_code,
                elapsed_ms,
                req_id,
            )
            await asyncio.sleep(backend_retry_backoff_sec() * (2 ** (attempt - 1)))
            continue

        if resp.is_success:
            try:
                data = resp.json()
            except ValueError as exc:
                logger.error(
                    "Backend POST %s non-JSON body status=%s request_id=%s",
                    path,
                    resp.status_code,
                    req_id,
                )
                raise BackendRequestError(
                    f"Backend returned non-JSON: {exc}",
                    status_code=resp.status_code,
                ) from exc
            if not isinstance(data, dict):
                raise BackendRequestError(
                    "Backend JSON was not an object",
                    status_code=resp.status_code,
                    body=data,
                )
            total_ms = (time.monotonic() - overall_t0) * 1000
            logger.info(
                "Backend POST %s OK http=%s in %.0fms request_id=%s",
                path,
                resp.status_code,
                total_ms,
                req_id,
            )
            if total_ms > 8000:
                logger.warning(
                    "Backend POST %s slow: %.0fms (request_id=%s)",
                    path,
                    total_ms,
                    req_id,
                )
            return data

        detail = _extract_detail(resp)
        logger.warning(
            "Backend POST %s failed HTTP %s: %s (request_id=%s)",
            path,
            resp.status_code,
            detail[:500],
            req_id,
        )
        raise BackendRequestError(
            detail,
            status_code=resp.status_code,
            body=_safe_json(resp),
        )

    logger.error(
        "Backend POST %s exhausted retries (%s) last_error=%s request_id=%s",
        path,
        backend_max_retries(),
        last_error,
        req_id,
    )
    raise BackendRequestError(
        f"Backend unreachable after {backend_max_retries()} attempts: {last_error!s}",
        status_code=None,
    )


def _safe_json(resp: httpx.Response) -> Any:
    try:
        return resp.json()
    except Exception:
        return resp.text


def _extract_detail(resp: httpx.Response) -> str:
    body = _safe_json(resp)
    if isinstance(body, dict) and body.get("detail") is not None:
        d = body["detail"]
        if isinstance(d, list):
            return "; ".join(str(x) for x in d)
        return str(d)
    return f"HTTP {resp.status_code}"
