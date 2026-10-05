"""Tests for the stateless reverse-share relay.

The backend stores no room data and no file bytes -- it only:
* joins sockets into a Channels group keyed by ``room_id``
* forwards JSON messages between group members
* streams a file's bytes to the requesting client on demand

So the test surface is:
* the Channels group naming
* the connection counters (Django cache-backed)
* the ``stream_file`` passthrough (delegates to ``open_chunk_stream``)
"""

import uuid

import pytest

from apps.reverse import _connection_counters as cc
from apps.reverse.relay import group_name, stream_file


# ---------------------------------------------------------------------------
# Channel group naming
# ---------------------------------------------------------------------------


def test_group_name_is_valid_channels_name() -> None:
    """Group names must be ASCII alphanumerics plus ``-_.`` only."""
    room_id = str(uuid.uuid4())
    name = group_name(room_id)
    assert name.startswith("room-")
    assert name.endswith(room_id)
    # Channels allows only these characters.
    allowed = set("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_.")
    assert set(name) <= allowed


def test_group_name_is_deterministic() -> None:
    assert group_name("abc") == group_name("abc")


# ---------------------------------------------------------------------------
# Connection counters
# ---------------------------------------------------------------------------


def test_counters_increment_and_decrement() -> None:
    room_id = str(uuid.uuid4())
    assert cc.get(room_id, "hosts") == 0
    assert cc.get(room_id, "guests") == 0

    cc.increment(room_id, "hosts")
    assert cc.get(room_id, "hosts") == 1

    cc.increment(room_id, "guests")
    cc.increment(room_id, "guests")
    assert cc.get(room_id, "guests") == 2

    cc.decrement(room_id, "guests")
    assert cc.get(room_id, "guests") == 1


def test_counters_decrement_clamps_at_zero() -> None:
    room_id = str(uuid.uuid4())
    cc.decrement(room_id, "hosts")  # no prior increment
    assert cc.get(room_id, "hosts") == 0


def test_counters_increment_after_expiry_of_key() -> None:
    """A missing cache key is seeded on the first increment."""
    room_id = str(uuid.uuid4())
    # Force the key to be absent.
    from django.core.cache import cache

    cache.delete(f"reverse:room:{room_id}:hosts")
    value = cc.increment(room_id, "hosts")
    assert value == 1
    assert cc.get(room_id, "hosts") == 1


# ---------------------------------------------------------------------------
# stream_file passthrough
# ---------------------------------------------------------------------------


def test_stream_file_delegates_to_open_chunk_stream() -> None:
    """``stream_file`` must return the same async iterator as the underlying
    ``open_chunk_stream`` so the consumer can drive it with ``async for``.
    """
    from apps.files import services as file_services

    # We do not actually stream here (no file uploaded); we only verify the
    # return type is an async iterator / async generator, which is what the
    # consumer relies on.
    result = stream_file("nonexistent-key", 0, 1024)
    assert hasattr(result, "__aiter__") or hasattr(result, "__anext__")
