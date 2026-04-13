import redis.asyncio as redis

from app.settings import settings


class RedisClient:
    _instance: redis.Redis | None = None

    @classmethod
    def get(cls) -> redis.Redis:
        if cls._instance is None:
            cls._instance = redis.from_url(
                settings.REDIS_ENDPOINT,
                encoding="utf-8",
                decode_responses=True,
            )
        return cls._instance

    @classmethod
    async def aclose(cls) -> None:
        """Close the Redis client connection pool."""
        if cls._instance is not None:
            await cls._instance.aclose()
            cls._instance = None
