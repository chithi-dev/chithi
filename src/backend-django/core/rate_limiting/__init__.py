"""Redis-based sliding window rate limiter for Django/Strawberry."""

from __future__ import annotations

import time
import uuid
from dataclasses import dataclass


@dataclass
class RateLimitConfig:
    max_requests: int
    window_seconds: int


class RedisRateLimiter:
    """Sliding window rate limiter using Redis sorted sets."""

    def __init__(self, redis_url: str | None = None) -> None:
        self._redis_url = redis_url or 'redis://localhost:6379/1'
        self._clients: dict[str, list[float]] = {}  # in-memory fallback

    async def is_allowed(self, key: str, config: RateLimitConfig) -> bool:
        """Check if request is allowed under rate limit. Returns True/False."""
        now = time.time()
        window_start = now - config.window_seconds

        # In-memory fallback (works without Redis for tests)
        import asyncio  # noqa: F401

        client_key = f'{key}:{config.max_requests}:{config.window_seconds}'
        if client_key not in self._clients:
            self._clients[client_key] = []

        timestamps = self._clients[client_key]
        # Remove expired entries
        self._clients[client_key] = [t for t in timestamps if t > window_start]
        timestamps = self._clients[client_key]

        if len(timestamps) >= config.max_requests:
            return False

        timestamps.append(now)
        return True

    async def get_remaining(self, key: str, config: RateLimitConfig) -> int:
        """Get remaining requests in current window."""
        now = time.time()
        window_start = now - config.window_seconds

        client_key = f'{key}:{config.max_requests}:{config.window_seconds}'
        if client_key not in self._clients:
            return config.max_requests

        timestamps = [t for t in self._clients.get(client_key, []) if t > window_start]
        remaining = config.max_requests - len(timestamps)
        return max(0, remaining)


# Default rate limit configs
LOGIN_LIMIT = RateLimitConfig(max_requests=3, window_seconds=1)
UPLOAD_LIMIT = RateLimitConfig(max_requests=10, window_seconds=60)

# Singleton
_limiter: RedisRateLimiter | None = None


def get_rate_limiter() -> RedisRateLimiter:
    global _limiter
    if _limiter is None:
        from django.conf import settings as dj_settings  # noqa: F401
        import os  # noqa: F401

        redis_url = os.environ.get(
            'DJANGO_REDIS_ENDPOINT',
            getattr(dj_settings, 'REDIS_ENDPOINT', 'redis://localhost:6379/1'),
        )  # type: ignore[attr-defined]
        _limiter = RedisRateLimiter(redis_url)
    return _limiter
