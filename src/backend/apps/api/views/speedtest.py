"""Speedtest endpoints (django-ninja).

These expose the same three routes the CLI uses for bandwidth measurement,
now under the ninja API at /api/speedtest/.
"""

import os
import time
from collections.abc import AsyncIterator

from django.http import HttpRequest, StreamingHttpResponse
from ninja import Query, Router

from apps.api.schemas.speedtest import SpeedtestQuery, SpeedtestResponse

router = Router()

_CHUNK_SIZE = 256 * 1024
_RANDOM_BYTES = os.urandom(_CHUNK_SIZE)
_MAX_SIZE = 100_000_000


async def _iter_chunks(size: int) -> AsyncIterator[bytes]:
    remaining = size
    while remaining >= _CHUNK_SIZE:
        yield _RANDOM_BYTES
        remaining -= _CHUNK_SIZE
    if remaining > 0:
        yield _RANDOM_BYTES[:remaining]


@router.get("/speedtest/download/")
async def speedtest_download(
    request: HttpRequest, params: SpeedtestQuery = Query(...)
) -> StreamingHttpResponse:
    size = max(1, min(params.bytes, _MAX_SIZE))
    response = StreamingHttpResponse(
        _iter_chunks(size), content_type="application/octet-stream"
    )
    response["Content-Length"] = str(size)
    response["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response["Pragma"] = "no-cache"
    response["Expires"] = "0"
    return response


@router.post("/speedtest/upload/")
async def speedtest_upload(request: HttpRequest) -> dict:
    body = request.body
    return {
        "bytes_received": len(body) if body else 0,
        "timestamp": time.time(),
    }


@router.get("/speedtest/latency/")
async def speedtest_latency(request: HttpRequest) -> dict:
    return {
        "bytes_received": 0,
        "timestamp": time.time(),
    }
