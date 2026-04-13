import time
from collections.abc import Callable
from typing import Any, Sequence, TypeAlias

from fastapi import HTTPException
from starlette.requests import HTTPConnection

from app.deps import RedisDep
from app.lua import rate_limit

RateLimit: TypeAlias = tuple[int, int]
RateLimits: TypeAlias = Sequence[RateLimit]


async def rate_limiter_guard(request: HTTPConnection, redis_client: RedisDep) -> None:
    """Enforce rate limits attached to an endpoint via `_rate_limits`.

    `_rate_limits` should be a sequence of `(limit, window_seconds)` tuples.
    """
    if request.scope.get("type") == "websocket":
        return

    endpoint: Callable[..., Any] | None = request.scope.get("endpoint")
    if endpoint is None:
        return

    limits: RateLimits | None = getattr(endpoint, "_rate_limits", None)
    if not limits:
        return

    client_ip: str = "unknown"
    for header in (
        "x-forwarded-for",
        "cf-connecting-ip",
        "true-client-ip",
        "x-real-ip",
        "x-client-ip",
    ):
        if header in request.headers:
            client_ip = request.headers[header].split(",")[0].strip()
            break
    else:
        if request.client and request.client.host:
            client_ip = request.client.host

    now: float = time.time()

    endpoint_name: str = getattr(endpoint, "__name__", "unknown")

    for limit, window in limits:
        key = f"rl:{client_ip}:{endpoint_name}:{window}"

        is_limited = bool(
            redis_client.eval(
                rate_limit.code, 1, key, str(now), str(window), str(limit)
            )
        )

        if is_limited:
            raise HTTPException(
                status_code=429,
                detail=f"Rate limit exceeded: {limit} requests per {window}s.",
            )
