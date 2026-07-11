from __future__ import annotations

import hashlib
import json
from typing import Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from app.core.config import get_settings
from app.core.redis import get_redis

IDEMPOTENCY_HEADER = "idempotency-key"
IDEMPOTENCY_TTL_SECONDS = 86_400


class IdempotencyMiddleware(BaseHTTPMiddleware):
    """Replay-safe handling for money-moving POST endpoints."""

    def __init__(self, app, *, path_prefix: str = "/api/v1/transactions") -> None:
        super().__init__(app)
        self._path_prefix = path_prefix

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        if request.method != "POST" or not request.url.path.startswith(self._path_prefix):
            return await call_next(request)

        idempotency_key = request.headers.get(IDEMPOTENCY_HEADER)
        if not idempotency_key:
            return JSONResponse(
                status_code=400,
                content={
                    "code": "idempotency_key_required",
                    "message": "Idempotency-Key header is required for transaction requests.",
                },
            )

        settings = get_settings()
        redis = await get_redis(settings.redis_cache_db)
        body = await request.body()
        fingerprint = hashlib.sha256(f"{request.url.path}:{body.decode()}".encode()).hexdigest()
        cache_key = f"idempotency:{idempotency_key}:{fingerprint}"

        cached = await redis.get(cache_key)
        if cached:
            payload = json.loads(cached)
            return JSONResponse(status_code=payload["status_code"], content=payload["body"])

        response = await call_next(request)
        if response.status_code < 500:
            response_body = b""
            async for chunk in response.body_iterator:
                response_body += chunk
            try:
                parsed_body = json.loads(response_body.decode() or "{}")
            except json.JSONDecodeError:
                parsed_body = {"raw": response_body.decode()}

            await redis.setex(
                cache_key,
                IDEMPOTENCY_TTL_SECONDS,
                json.dumps({"status_code": response.status_code, "body": parsed_body}),
            )
            return JSONResponse(status_code=response.status_code, content=parsed_body)

        return response
