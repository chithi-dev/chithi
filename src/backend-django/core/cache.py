"""Redis cache access via django.core.cache."""

from __future__ import annotations


def redis_get(key: str) -> bytes | None:  # noqa: A003 - intentional shadowing
    """Get a value from Redis via Django's cache framework."""
    from django.core.cache import cache

    return cache.get(key)  # type: ignore[return-value]


def redis_set(key: str, value: bytes | str, timeout: int | None = None) -> bool:  # noqa: A003 - intentional shadowing
    """Set a value in Redis via Django's cache framework."""
    from django.core.cache import cache

    return cache.set(key, value, timeout=timeout)  # type: ignore[return-value]


def redis_delete(key: str) -> bool:  # noqa: A003 - intentional shadowing
    """Delete a key from Redis via Django's cache framework."""
    from django.core.cache import cache

    return cache.delete(key)  # type: ignore[return-value]


async def redis_get_async(key: str) -> bytes | None:  # noqa: A003 - intentional shadowing
    """Async get from Redis via Django's cache framework."""
    from django.core.cache import cache

    result = await cache.aget(key)  # type: ignore[union-attr]
    return result


async def redis_set_async(key: str, value: bytes | str, timeout: int | None = None) -> bool:  # noqa: A003 - intentional shadowing
    """Async set in Redis via Django's cache framework."""
    from django.core.cache import cache

    return await cache.aset(key, value, timeout=timeout)  # type: ignore[union-attr]


async def redis_delete_async(key: str) -> bool:  # noqa: A003 - intentional shadowing
    """Async delete key from Redis via Django's cache framework."""
    from django.core.cache import cache

    return await cache.adelete(key)  # type: ignore[union-attr]


async def redis_version() -> str | None:
    """Get Redis version using Django's cache framework."""
    from django.core.cache import cache
    from django.conf import settings as dj_settings  # noqa: F401

    try:
        info = await cache.aconnection().info("server")  # type: ignore[union-attr]
        version = info.get("redis_version", None) if isinstance(info, dict) else None
        return str(version) if version else None
    except Exception:
        # Fallback: try the sync path through Django's cache
        from django.core.cache import caches

        try:
            client_cache = caches["default"]
            with client_cache._lock():  # type: ignore[attr-defined]
                conn = client_cache.get_connection()  # type: ignore[union-attr]
                info = conn.client.info("server")  # type: ignore[attr-defined]
                version = info.get("redis_version", None) if isinstance(info, dict) else None
                return str(version) if version else None
        except Exception:
            return None


async def redis_ping() -> bool:
    """Check Redis connectivity via Django's cache framework."""
    from django.core.cache import cache

    try:
        await cache.aset("_ping_test", "1", timeout=1)  # type: ignore[union-attr]
        result = await cache.aget_async("_ping_test")  # type: ignore[attr-defined]
        return result == "1"
    except Exception:
        return False
