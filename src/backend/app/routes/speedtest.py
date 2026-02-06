import os

from fastapi import APIRouter, Query, Request
from fastapi.responses import StreamingResponse

from app.schemas.speedtest import UploadPayload

router = APIRouter()

# 1 MB chunk of random data
CHUNK_SIZE = 1024 * 1024
RANDOM_BYTES = os.urandom(CHUNK_SIZE)


@router.get("/speedtest/download", tags=["Speedtest"])
async def speedtest_download(
    size: int = Query(
        default=10 * 1024 * 1024, alias="bytes", description="Size in bytes to download"
    ),
):
    """
    Download speedtest endpoint.
    Streams a requested amount of random bytes.
    """

    async def iter_content():
        bytes_remaining = size
        while bytes_remaining > 0:
            yield_bytes = min(CHUNK_SIZE, bytes_remaining)
            if yield_bytes == CHUNK_SIZE:
                yield RANDOM_BYTES
            else:
                yield RANDOM_BYTES[:yield_bytes]
            bytes_remaining -= yield_bytes

    headers = {
        "Content-Length": str(size),
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
    }

    return StreamingResponse(
        iter_content(), media_type="application/octet-stream", headers=headers
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
