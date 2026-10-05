"""Chunked upload endpoints (django-ninja).

Mirrors the three-step contract used by the GraphQL mutations:

1. ``POST /upload/register/`` - create the File record, return its key
2. ``POST /upload/chunk/``    - upload one 50 MB chunk (multipart/form-data)
3. ``POST /upload/complete/`` - verify all chunks arrived

Both transports write to the same S3 / local objects via ``services.upload_chunk``.

The storage service is async (aioboto3), so the views are async too. The Django
ORM and the ``Config`` singleton are sync, so every database access below is
wrapped in ``sync_to_async`` to keep the event loop unblocked and avoid
``SynchronousOnlyOperation``.
"""

from uuid import uuid4

from asgiref.sync import sync_to_async
from django.utils import timezone
from ninja import Form, Router
from ninja.errors import ValidationError

from apps.api.schemas.upload import (
    ChunkResponse,
    CompleteResponse,
    RegisterRequest,
    RegisterResponse,
)
from apps.api.utils.validation import (
    ensure_uploads_enabled,
    validate_chunk,
    validate_registration,
)
from apps.files import services
from apps.files.models import File

router = Router()


def _create_file(body: RegisterRequest) -> File:
    return File.objects.create(
        key=str(uuid4()),
        filename=body.filename,
        size=body.total_size,
        chunk_count=body.chunk_count,
        expires_at=timezone.now() + timezone.timedelta(seconds=body.expires_at),
        expire_after_n_download=body.expire_after_n_download,
        number_of_files=body.number_of_files,
    )


def _file_by_key(file_key: str) -> File | None:
    return File.objects.filter(key=file_key).first()


@router.post("/register/", response=RegisterResponse)
async def register_file(request, body: RegisterRequest) -> RegisterResponse:
    await ensure_uploads_enabled()
    await validate_registration(body.total_size, body.chunk_count, body.expires_at)

    file_obj = await sync_to_async(_create_file)(body)

    return RegisterResponse(
        id=str(file_obj.id),
        key=file_obj.key,
        chunk_count=file_obj.chunk_count,
        chunk_size=services.CHUNK_SIZE_BYTES,
    )


@router.post("/chunk/", response=ChunkResponse)
async def upload_chunk(
    request,
    file_key: Form[str],
    chunk_index: Form[int],
) -> ChunkResponse:
    await ensure_uploads_enabled()

    if await sync_to_async(_file_by_key)(file_key) is None:
        raise ValidationError("File not found.")

    upload = request.FILES.get("chunk")
    if upload is None:
        raise ValidationError("Uploaded chunk is empty.")

    data = upload.read()
    if isinstance(data, memoryview):
        data = bytes(data)

    await validate_chunk(data, chunk_index)
    await services.upload_chunk(file_key, chunk_index, data)

    return ChunkResponse(ok=True, chunk_index=chunk_index, bytes=len(data))


@router.post("/complete/", response=CompleteResponse)
async def complete_upload(request, file_key: Form[str]) -> CompleteResponse:
    file_obj = await sync_to_async(_file_by_key)(file_key)
    if file_obj is None:
        raise ValidationError("File not found.")

    if not await services.file_chunks_exist(file_obj.key, file_obj.chunk_count):
        raise ValidationError("Some chunks are missing; upload incomplete.")

    return CompleteResponse(ok=True, id=str(file_obj.id), key=file_obj.key)
