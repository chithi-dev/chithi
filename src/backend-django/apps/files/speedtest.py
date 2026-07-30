"""Speedtest endpoints — optimized for maximum throughput.

These endpoints measure upload/download speed by streaming data
with minimal overhead. They use pre-allocated random bytes to
avoid per-request entropy cost.
"""

import os
import time

from django.http import HttpResponse, JsonResponse
from django.views.decorators.http import require_http_methods

# Pre-allocate random bytes in memory — reused across requests.
_CHUNK_SIZE = 256 * 1024  # 256KB — larger chunks = fewer syscalls
_RANDOM_BYTES = os.urandom(_CHUNK_SIZE)

# Maximum speedtest transfer size: 100MB
_MAX_SIZE = 100_000_000


@require_http_methods(["GET"])
def speedtest_download(request):
    """Download speedtest — streams random bytes."""
    try:
        size = int(request.GET.get("bytes", _MAX_SIZE))
    except (TypeError, ValueError):
        size = _MAX_SIZE

    size = max(1, min(size, _MAX_SIZE))

    response = HttpResponse(
        _iter_download_chunks(size),
        content_type="application/octet-stream",
    )
    response["Content-Length"] = str(size)
    response["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response["Pragma"] = "no-cache"
    response["Expires"] = "0"
    return response


def _iter_download_chunks(size: int):
    """Yield chunks of random bytes up to *size* total."""
    remaining = size
    while remaining >= _CHUNK_SIZE:
        yield _RANDOM_BYTES
        remaining -= _CHUNK_SIZE
    if remaining > 0:
        yield _RANDOM_BYTES[:remaining]


@require_http_methods(["POST"])
def speedtest_upload(request):
    """Upload speedtest — reads and discards the request body."""
    bytes_received = 0

    # Read from the raw WSGI input stream for maximum speed
    wsgi_input = request.environ.get("wsgi.input")
    if wsgi_input:
        while True:
            chunk = wsgi_input.read(_CHUNK_SIZE)
            if not chunk:
                break
            bytes_received += len(chunk)

    return JsonResponse({
        "bytes_received": bytes_received,
        "timestamp": time.time(),
    })


@require_http_methods(["GET"])
def speedtest_latency(request):
    """Latency test — returns server timestamp."""
    return JsonResponse({"timestamp": time.time()})
