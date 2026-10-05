import asyncio
from uuid import uuid4

import strawberry
from asgiref.sync import sync_to_async
from strawberry.file_uploads import Upload
from strawberry.types import Info
from django.utils import timezone

from apps.config.models import Config
from apps.files.models import File
from apps.files import services
from apps.graphql.types import FileType

# Re-export the chunk size so the frontend contract is documented in one place.
CHUNK_SIZE = services.CHUNK_SIZE_BYTES


@strawberry.type
class FileMutation:
    @strawberry.mutation
    async def upload_file_chunk(
        self,
        info: Info,
        file_key: str,
        chunk_index: int,
        chunk: Upload,
        is_last: bool,
    ) -> bool:
        """Upload a single chunk (<= 50 MB) of an encrypted file.

        The frontend splits the encrypted payload into 50 MB chunks and calls
        this mutation once per chunk. Chunks are stored as separate S3 objects
        under ``{file_key}/chunk-{index}``.

        ``is_last`` marks the final chunk; when it arrives and the file record
        already exists, no extra work is needed (the File row is created by the
        first ``register_file`` call before chunks start).
        """
        config = await Config.aload()
        if not config.allow_uploads:
            raise ValueError("File uploads are currently disabled.")

        await sync_to_async(File.objects.get)(key=file_key)

        # Materialise the chunk bytes from the Upload.
        if isinstance(chunk, (bytes, bytearray, memoryview)):
            data = bytes(chunk)
        elif isinstance(chunk, list):
            data = b"".join(bytes(p) for p in chunk)
        elif hasattr(chunk, "read") and callable(getattr(chunk, "read")):
            data = chunk.read()
        else:
            upload = info.context.request.FILES.get("chunk")
            if upload is None:
                raise ValueError("Uploaded chunk is empty.")
            data = upload.read()

        if data.endswith(b"\r\n"):
            data = data[:-2]

        if not data:
            raise ValueError("Uploaded chunk is empty.")

        # A single chunk must never exceed the agreed chunk size - the client
        # is expected to split at CHUNK_SIZE_BYTES, so an oversized chunk means
        # a buggy or hostile client. Reject before writing anything to storage.
        if len(data) > services.CHUNK_SIZE_BYTES:
            raise ValueError(
                f"Chunk {chunk_index} is {len(data)} bytes, exceeding the "
                f"maximum chunk size of {services.CHUNK_SIZE_BYTES}."
            )

        await services.upload_chunk(file_key, chunk_index, data)
        return True

    @strawberry.mutation
    async def register_file(
        self,
        info: Info,
        filename: str,
        total_size: int,
        chunk_count: int,
        expires_at: int,
        expire_after_n_download: int,
        number_of_files: int | None = None,
    ) -> FileType:
        """Register a new file before uploading its chunks.

        Returns the file record (including its UUID key) so the frontend knows
        where to upload chunks and how many it must send.
        """
        config = await Config.aload()
        if not config.allow_uploads:
            raise ValueError("File uploads are currently disabled.")

        if total_size == 0:
            raise ValueError("File size must be positive.")
        if total_size > config.max_file_size_limit:
            raise ValueError(
                f"File size {total_size} exceeds the maximum allowed size "
                f"{config.max_file_size_limit}."
            )
        if chunk_count < 1:
            raise ValueError("chunk_count must be at least 1.")

        if expires_at > config.default_expiry:
            raise ValueError(
                f"Expiry duration {expires_at}s exceeds the maximum allowed "
                f"{config.default_expiry}s."
            )

        expires_at_dt = timezone.now() + timezone.timedelta(seconds=expires_at)

        file_obj = await sync_to_async(File.objects.create)(
            key=str(uuid4()),
            filename=filename,
            size=total_size,
            chunk_count=chunk_count,
            expires_at=expires_at_dt,
            expire_after_n_download=expire_after_n_download,
            number_of_files=number_of_files,
        )

        # Schedule a one-shot deletion at the expiry instant (shared helper so
        # the ninja transport schedules identically).
        services.schedule_expiry(file_obj.key, expires_at_dt)
        return file_obj

    @strawberry.mutation
    async def complete_upload(self, file_id: strawberry.ID) -> bool:
        """Mark a file's upload as complete and verify all chunks are present."""
        try:
            file_obj = await sync_to_async(File.objects.get)(id=file_id)
        except File.DoesNotExist:
            return False

        ok = await services.file_chunks_exist(file_obj.key, file_obj.chunk_count)
        if not ok:
            raise ValueError("Some chunks are missing; upload incomplete.")
        return True

    @strawberry.mutation
    async def delete_file(self, file_id: strawberry.ID) -> bool:
        """Delete a file and all of its chunks from storage."""
        try:
            file_obj = await sync_to_async(File.objects.get)(id=file_id)
        except File.DoesNotExist:
            return False

        await services.delete_file_chunks(file_obj.key)
        await sync_to_async(file_obj.delete)()
        return True

    @strawberry.mutation
    async def chunk_url(self, file_id: strawberry.ID, chunk_index: int) -> str:
        """Return a URL (presigned, if S3) to fetch one chunk directly.

        The frontend downloads each chunk from this URL - bypassing Django -
        and reassembles them client-side before decryption.
        """
        try:
            file_obj = await sync_to_async(File.objects.get)(id=file_id)
        except File.DoesNotExist:
            raise ValueError("File not found.")

        if chunk_index < 0 or chunk_index >= file_obj.chunk_count:
            raise ValueError("chunk_index out of range.")

        if file_obj.is_expired:
            raise ValueError("File has expired.")

        # Count a download only when the *last* chunk is fetched: a client
        # cannot complete the file without it, so this is the signal that a
        # full download actually happened (a partial one that aborts earlier
        # is not counted). When the limit is hit this schedules immediate
        # deletion.
        if chunk_index == file_obj.chunk_count - 1:
            await services.record_download(file_obj.key)

        return await services.presigned_chunk_url(file_obj.key, chunk_index)
