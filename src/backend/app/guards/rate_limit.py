import time

from fastapi import HTTPException
from starlette.requests import HTTPConnection

from app.deps import RedisDep
from app.lua import rate_limit


async def rate_limiter_guard(request: HTTPConnection, redis_client: RedisDep):
    if request.scope.get("type") == "websocket":
        return

    endpoint = request.scope.get("endpoint")
    if not endpoint or not hasattr(endpoint, "_rate_limits"):
        return

    client_host = request.client.host if request.client else "unknown"
    user_id = request.headers.get("X-Forwarded-For", client_host).split(",")[0]
    now = time.time()

    for limit, window in endpoint._rate_limits:
        key = f"rl:{user_id}:{endpoint.__name__}:{window}"

        is_limited = redis_client.eval(
            rate_limit.code, 1, key, str(now), str(window), str(limit)
        )

        if is_limited:
            raise HTTPException(
                status_code=429,
                detail=f"Rate limit exceeded: {limit} requests per {window}s.",
            )
