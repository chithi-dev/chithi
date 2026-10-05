"""Shared validation for the upload endpoints.

Both the register and chunk endpoints enforce the same limits from the
singleton ``Config``. Centralising the checks here keeps the view functions
short and guarantees the GraphQL and HTTP upload paths stay in agreement.

The ``Config`` singleton is read through ``Config.aload()`` -- a native async
method on the model -- so these async checks never block the event loop.
"""

from ninja.errors import ValidationError

from apps.config.models import Config


async def ensure_uploads_enabled() -> None:
    config = await Config.aload()
    if not config.allow_uploads:
        raise ValidationError("File uploads are currently disabled.")


async def validate_registration(
    total_size: int,
    chunk_count: int,
    expires_at: int,
) -> None:
    config = await Config.aload()

    if total_size <= 0:
        raise ValidationError("File size must be positive.")

    if total_size > config.max_file_size_limit:
        raise ValidationError(
            f"File size {total_size} exceeds the maximum allowed size "
            f"{config.max_file_size_limit}."
        )

    if chunk_count < 1:
        raise ValidationError("chunk_count must be at least 1.")

    if expires_at > config.default_expiry:
        raise ValidationError(
            f"Expiry duration {expires_at}s exceeds the maximum allowed "
            f"{config.default_expiry}s."
        )


async def validate_chunk(data: bytes, chunk_index: int) -> None:
    from apps.files import services

    if not data:
        raise ValidationError("Uploaded chunk is empty.")

    if len(data) > services.CHUNK_SIZE_BYTES:
        raise ValidationError(
            f"Chunk {chunk_index} is {len(data)} bytes, exceeding the "
            f"maximum chunk size of {services.CHUNK_SIZE_BYTES}."
        )
