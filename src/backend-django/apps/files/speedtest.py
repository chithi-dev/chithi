"""Speedtest endpoints — optimized for maximum throughput.

These endpoints measure upload/download speed by streaming data
with minimal overhead. They use pre-allocated random bytes to
avoid per-request entropy cost.
"""

from __future__ import annotations

import os
import time
from typing import Generator, Iterator

from django.http import HttpRequest, JsonResponse, StreamingHttpResponse
from django.views.decorators.http import require_http_methods

# Pre-allocate random bytes in memory — reused across requests.
_CHUNK_SIZE: int = 256 * 1024  # 256KB — larger chunks = fewer syscalls
_RANDOM_BYTES: bytes = os.urandom(_CHUNK_SIZE)

# Maximum speedtest transfer size: 100MB
_MAX_SIZE: int = 100_000_000


@require_http_methods(["GET"])
async def speedtest_download(request: HttpRequest) -> StreamingHttpResponse:
    """Download speedtest — streams random bytes."""
    try:
        size: int = int(request.GET.get("bytes", _MAX_SIZE))
    except (TypeError, ValueError):
        size = _MAX_SIZE

    size = max(1, min(size, _MAX_SIZE))

    response: StreamingHttpResponse = StreamingHttpResponse(
        _iter_download_chunks(size),
        content_type="application/octet-stream",
    )
    response["Content-Length"] = str(size)
    response["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response["Pragma"] = "no-cache"
    response["Expires"] = "0"
    return response


def _iter_download_chunks(size: int) -> Iterator[bytes]:
    """Yield chunks of random bytes up to *size* total."""
    remaining: int = size
    while remaining >= _CHUNK_SIZE:
        yield _RANDOM_BYTES
        remaining -= _CHUNK_SIZE
    if remaining > 0:
        yield _RANDOM_BYTES[:remaining]


@require_http_methods(["POST"])
async def speedtest_upload(request: HttpRequest) -> JsonResponse:
    """Upload speedtest — reads and discards the request body."""
    bytes_received: int = 0

    # Read from the ASGI body for maximum speed
    body: bytes = request.body
    if body:
        bytes_received = len(body)

    return JsonResponse({
        "bytes_received": bytes_received,
        "timestamp": time.time(),
    })


@require_http_methods(["GET"])
async def speedtest_latency(request: HttpRequest) -> JsonResponse:
    """Latency test — returns server timestamp."""
    return JsonResponse({"timestamp": time.time()})
