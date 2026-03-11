import time

from fastapi import HTTPException
from starlette.requests import HTTPConnection

from app.deps import RedisDep

LUA_RATELIMIT = """
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local clear_before = now - window

redis.call('ZREMRANGEBYSCORE', key, 0, clear_before)
local amount = redis.call('ZCARD', key)

if amount < limit then
    redis.call('ZADD', key, now, now)
    redis.call('EXPIRE', key, window)
    return 0
else
    return 1
end
"""


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

        is_limited = await redis_client.eval(
            LUA_RATELIMIT, 1, key, str(now), str(window), str(limit)
        )  # type: ignore[misc]

        if is_limited:
            raise HTTPException(
                status_code=429,
                detail=f"Rate limit exceeded: {limit} requests per {window}s.",
            )
