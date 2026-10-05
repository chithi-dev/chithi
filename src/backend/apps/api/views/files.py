"""File metadata and chunk-URL endpoints (django-ninja).

These back the CLI download flow:

1. ``GET /files/{file_key}/info/`` - metadata for one file (by key or ID)
2. ``GET /files/{file_key}/chunk/{index}/`` - a presigned S3 URL for one chunk

Both mirror the GraphQL ``fileInfo`` query and ``chunkUrl`` mutation. The
database read is sync, so it is wrapped in ``sync_to_async``; the URL
generation runs through the storage backend and is likewise awaited.
"""

import asyncio
from uuid import UUID

from asgiref.sync import sync_to_async
from django.http import HttpRequest, HttpResponse, StreamingHttpResponse
from ninja import Router
from ninja.errors import ValidationError

from apps.api.schemas.files import ChunkUrlResponse, FileInfoResponse
from apps.files import services
from apps.files.models import File

router = Router()


def _file_by_key_or_id(identifier: str) -> File | None:
    """Resolve a file by its S3 key first, then by its UUID primary key.

    A File key is itself a UUID, so key and id cannot be told apart by shape.
    The key is what the client receives from register, so it is tried first;
    only if no row matches does the id lookup run.
    """
    by_key = File.objects.filter(key=identifier).first()
    if by_key is not None:
        return by_key

    try:
        file_id = UUID(identifier)
    except (ValueError, TypeError):
        return None

    return File.objects.filter(id=file_id).first()


def _file_info_response(file_obj: File) -> FileInfoResponse:
    return FileInfoResponse(
        id=str(file_obj.id),
        key=file_obj.key,
        filename=file_obj.filename,
        size=file_obj.size,
        number_of_files=file_obj.number_of_files,
        download_count=file_obj.download_count,
        created_at=file_obj.created_at.isoformat(),
        expires_at=file_obj.expires_at.isoformat(),
        expire_after_n_download=file_obj.expire_after_n_download,
        is_expired=file_obj.is_expired,
        chunk_count=file_obj.chunk_count,
    )


@router.get("/files/{file_key}/info/", response=FileInfoResponse)
async def file_info(request: HttpRequest, file_key: str) -> FileInfoResponse:
    file_obj = await sync_to_async(_file_by_key_or_id)(file_key)
    if file_obj is None:
        raise ValidationError("File not found.")

    return _file_info_response(file_obj)


@router.get("/files/{file_key}/chunk/{chunk_index}/", response=ChunkUrlResponse)
async def chunk_url(request: HttpRequest, file_key: str, chunk_index: int) -> ChunkUrlResponse:
    file_obj = await sync_to_async(_file_by_key_or_id)(file_key)
    if file_obj is None:
        raise ValidationError("File not found.")

    if file_obj.is_expired:
        raise ValidationError("File has expired.")

    if chunk_index < 0 or chunk_index >= file_obj.chunk_count:
        raise ValidationError("chunk_index out of range.")

    # Count a download only when the *last* chunk is fetched: a client cannot
    # complete the file without it, so this is the signal that a full download
    # actually happened (a partial one that aborts earlier is not counted).
    if chunk_index == file_obj.chunk_count - 1:
        await services.record_download(file_obj.key)

    url = await services.presigned_chunk_url(file_obj.key, chunk_index)
    return ChunkUrlResponse(url=url)


@router.get("/files/{file_key}/chunk/{chunk_index}/bytes/")
async def chunk_bytes(request: HttpRequest, file_key: str, chunk_index: int) -> HttpResponse:
    """Proxy one chunk's bytes through the backend.

    The single download endpoint when a CDN is not used (or when the operator
    wants all egress to flow through the app): the backend streams the chunk
    straight from the storage backend (S3/CDN/local) to the client, so the
    client talks to exactly one URL and never contacts S3/CDN directly.
    """
    file_obj = await sync_to_async(_file_by_key_or_id)(file_key)
    if file_obj is None:
        raise ValidationError("File not found.")

    if file_obj.is_expired:
        raise ValidationError("File has expired.")

    if chunk_index < 0 or chunk_index >= file_obj.chunk_count:
        raise ValidationError("chunk_index out of range.")

    if chunk_index == file_obj.chunk_count - 1:
        await services.record_download(file_obj.key)

    fh, size = await services.open_chunk(file_obj.key, chunk_index)

    async def _iter_chunks():
        # Each read runs in the thread pool (thread_sensitive=False), so the
        # event loop stays free to serve every other request while the bytes
        # stream; the yield between reads guarantees the loop is released even
        # between the two pool hops. The handle is always closed, even if the
        # client aborts mid-stream.
        try:
            while True:
                block = await sync_to_async(fh.read, thread_sensitive=False)(
                    services.CHUNK_SIZE_BYTES
                )
                if not block:
                    break
                yield block
                await asyncio.sleep(0)
        finally:
            await sync_to_async(fh.close, thread_sensitive=False)()

    response = StreamingHttpResponse(_iter_chunks(), content_type="application/octet-stream")
    if size is not None:
        response["Content-Length"] = str(size)
    return response
