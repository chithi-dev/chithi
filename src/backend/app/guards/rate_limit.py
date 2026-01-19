import time

from fastapi import HTTPException, Request

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


async def rate_limiter_guard(request: Request, redis_client: RedisDep):
    # Get the function handling the current request
    endpoint = request.scope.get("endpoint")
    if not endpoint or not hasattr(endpoint, "_rate_limits"):
        return

    user_id = request.headers.get("X-Forwarded-For", request.client.host).split(",")[0]
    now = time.time()

    for limit, window in endpoint._rate_limits:
        key = f"rl:{user_id}:{endpoint.__name__}:{window}"

        # We use the redis_client injected by FastAPI
        is_limited = await redis_client.eval(LUA_RATELIMIT, 1, key, now, window, limit)

        if is_limited:
            raise HTTPException(
                status_code=429,
                detail=f"Rate limit exceeded: {limit} requests per {window}s.",
            )
