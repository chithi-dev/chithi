import os
from typing import Annotated, AsyncIterator

from fastapi import APIRouter, Query, Request
from fastapi.responses import StreamingResponse

from app.schemas.speedtest import UploadPayload
from app.settings import settings

router = APIRouter()

# 1 MB chunk of random data
CHUNK_SIZE = 1024 * 1024
RANDOM_BYTES = os.urandom(CHUNK_SIZE)


@router.get("/speedtest/download", tags=["Speedtest"])
async def speedtest_download(
    size: Annotated[
        int,
        Query(
            alias="bytes",
            description="Size in bytes to download",
            ge=1,
            le=settings.MAX_DOWNLOAD_SIZE,
        ),
    ] = settings.MAX_DOWNLOAD_SIZE,
) -> StreamingResponse:
    """
    Download speedtest endpoint.

    Streams a requested amount of bytes to measure client download speed.
    """

    async def iter_content() -> AsyncIterator[bytes]:
        bytes_remaining: int = size

        while bytes_remaining > 0:
            yield_size: int = min(CHUNK_SIZE, bytes_remaining)

            if yield_size == CHUNK_SIZE:
                yield RANDOM_BYTES
            else:
                yield RANDOM_BYTES[:yield_size]

            bytes_remaining -= yield_size

    headers: dict[str, str] = {
        "Content-Length": str(size),
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
    }

    return StreamingResponse(
        iter_content(),
        media_type="application/octet-stream",
        headers=headers,
    )


@router.post("/speedtest/upload", tags=["Speedtest"])
async def speedtest_upload(request: Request):
    """
    Upload speedtest endpoint.
    Reads and discards the request body.
    """
    bytes_received = 0
    async for chunk in request.stream():
        bytes_received += len(chunk)

    return UploadPayload(bytes_received=bytes_received)
