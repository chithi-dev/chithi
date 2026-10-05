"""Tests for the unified chunk-streaming abstraction in ``apps.files.services``.

Covers the local-filesystem path (aiofiles) and confirms CDN detection.
"""

import uuid

import pytest
from django.test import override_settings

from apps.files import services


async def _collect(stream) -> bytes:
    """Drain an async byte iterator into a single bytes value."""
    blocks = [block async for block in stream]
    return b"".join(blocks)


@pytest.mark.django_db
async def test_local_stream_yields_exact_bytes() -> None:
    """Uploading then streaming a chunk via the local path returns identical bytes."""
    key = uuid.uuid4().hex
    payload = b"hello world" * 1000
    await services.upload_chunk(key, 0, payload)

    streamed = await _collect(services.open_chunk_stream(key, 0))
    assert streamed == payload


@pytest.mark.django_db
async def test_local_stream_empty_chunk() -> None:
    """A zero-byte chunk streams zero blocks."""
    key = uuid.uuid4().hex
    await services.upload_chunk(key, 0, b"")

    streamed = await _collect(services.open_chunk_stream(key, 0))
    assert streamed == b""


async def test_cdn_base_detected_when_set() -> None:
    """S3_CDN_URL is surfaced by _cdn_base when configured."""
    with override_settings(S3_CDN_URL="https://cdn.example.com"):
        assert services._cdn_base() == "https://cdn.example.com"


async def test_cdn_base_empty_when_unset() -> None:
    """_cdn_base returns '' when no CDN is configured."""
    with override_settings(S3_CDN_URL=""):
        assert services._cdn_base() == ""
