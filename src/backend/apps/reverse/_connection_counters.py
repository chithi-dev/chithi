"""Connection counters for reverse-share rooms, backed by Django's cache.

Using the cache framework (Redis in production, LocMem in dev) instead of a
plain in-process dict means counts survive across worker processes and are
the same backend the rest of the app already uses for state.

Counts are display-only (the "N hosts online" badge); they are not used for
access control, so eventual consistency is acceptable.
"""

from django.core.cache import cache

_PREFIX = "reverse:room"


def _key(room_id: str, kind: str) -> str:
    return f"{_PREFIX}:{room_id}:{kind}"


def increment(room_id: str, kind: str) -> int:
    """Atomically increment and return the new count for *kind* (hosts|guests)."""
    key = _key(room_id, kind)
    # Django's incr raises ValueError on a missing key, so seed first.
    cache.add(key, 0, timeout=86400)
    return cache.incr(key)


def decrement(room_id: str, kind: str) -> int:
    """Atomically decrement and return the new count, clamped at zero."""
    key = _key(room_id, kind)
    if cache.get(key) is None:
        return 0
    value = cache.decr(key)
    if value < 0:
        cache.set(key, 0, timeout=86400)
        return 0
    return value


def get(room_id: str, kind: str) -> int:
    """Return the current count for *kind* (hosts|guests), or 0."""
    return cache.get(_key(room_id, kind), 0)
