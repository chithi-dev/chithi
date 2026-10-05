"""Speedtest views.

Three endpoints for bandwidth measurement. Each is decorated with
``@middleware_exempt`` so the :class:`ExemptMiddleware` bypasses the entire
middleware chain -- no session, auth, CSRF, or CORS overhead -- giving the
client a clean bandwidth measurement.

Routes (registered in ``core/urls.py``)::

    GET  /speedtest/download/?bytes=N
    POST /speedtest/upload/
    GET  /speedtest/latency/
"""

import os
import time

from django.http import HttpRequest, HttpResponse, StreamingHttpResponse
from django.views.decorators.http import require_GET, require_POST

from core.middlewares import middleware_exempt

_CHUNK_SIZE = 256 * 1024
_RANDOM_BYTES = os.urandom(_CHUNK_SIZE)
_MAX_SIZE = 100_000_000


def _iter_chunks(size: int):
    """Yield *size* random bytes in fixed-size chunks."""
    remaining = size
    while remaining >= _CHUNK_SIZE:
        yield _RANDOM_BYTES
        remaining -= _CHUNK_SIZE
    if remaining > 0:
        yield _RANDOM_BYTES[:remaining]


@middleware_exempt
@require_GET
def speedtest_download(request: HttpRequest) -> StreamingHttpResponse:
    """Stream up to ``?bytes=N`` of random data (default 10 MB)."""
    raw = request.GET.get("bytes", "10485760")
    try:
        size = max(1, min(int(raw), _MAX_SIZE))
    except ValueError:
        size = 10_485_760

    response = StreamingHttpResponse(
        _iter_chunks(size), content_type="application/octet-stream"
    )
    response["Content-Length"] = str(size)
    response["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response["Pragma"] = "no-cache"
    response["Expires"] = "0"
    return response


@middleware_exempt
@require_POST
def speedtest_upload(request: HttpRequest) -> HttpResponse:
    """Consume the request body and report how many bytes were received."""
    body = request.body if request.body else b""
    response = HttpResponse(
        f'{{"bytes_received": {len(body)}, "timestamp": {time.time()}}}',
        content_type="application/json",
    )
    return response


@middleware_exempt
@require_GET
def speedtest_latency(request: HttpRequest) -> HttpResponse:
    """Return a minimal JSON body with the server timestamp."""
    response = HttpResponse(
        f'{{"bytes_received": 0, "timestamp": {time.time()}}}',
        content_type="application/json",
    )
    return response
