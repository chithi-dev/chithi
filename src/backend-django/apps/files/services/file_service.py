"""All file-related business logic."""

from __future__ import annotations

import datetime
import io
import logging
from typing import BinaryIO

from uuid import UUID as _UUID

logger = logging.getLogger(__name__)


class FileService:
    """All file-related business logic."""

    CHUNK_SIZE = 8 * 1024 * 1024  # 8 MB (S3 multipart minimum)

    @classmethod
    async def validate_upload_limits(
        cls, file_size: int, expire_after: int | None = None
    ) -> dict:
        from apps.config.models import Config as ConfigModel

        cfg = await ConfigModel.get_config()  # type: ignore[attr-defined]

        if file_size > cfg.max_file_size_limit:  # type: ignore[union-attr]
            raise ValueError(
                f"File size {file_size} exceeds limit {cfg.max_file_size_limit}"
            )

        default_expiry = getattr(cfg, "default_expiry", 604800) or 604800

        expires_at = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(
            seconds=expire_after if expire_after else int(default_expiry),
        )

        return {
            "expires_at": expires_at,
            "default_expiry": default_expiry,
        }

    async def upload_to_storage_chunked(self, key: str, uploaded_file: object) -> bool:
        """Upload a file to S3 using multipart chunking (matches FastAPI behavior)."""
        from apps.config.models import Config as ConfigModel

        cfg = await ConfigModel.get_config()  # type: ignore[attr-defined]
        max_size = getattr(cfg, "max_file_size_limit", 100 * 1024**2)

        storage = __import__("core.storage.services", fromlist=["StorageService"]).StorageService
        content_type = getattr(uploaded_file, "content_type", "application/octet-stream") or "application/octet-stream"

        # For UploadedFile objects, read chunks
        if hasattr(uploaded_file, "chunks"):
            part_number = 1
            upload_id = None
            parts_info: list[dict] = []

            from django.conf import settings as _dj_settings
            session = __import__("aioboto3").Session()
            endpoint_url = getattr(_dj_settings, "RUSTFS_ENDPOINT_URL", "http://localhost:9000")  # type: ignore[attr-defined]
            access_key = getattr(_dj_settings, "RUSTFS_ACCESS_KEY", "rustfsadmin")  # type: ignore[attr-defined]
            secret_key = getattr(_dj_settings, "RUSTFS_SECRET_ACCESS_KEY", "rustfsadmin")  # type: ignore[attr-defined]
            bucket_name = getattr(_dj_settings, "RUSTFS_BUCKET_NAME", "chithi")  # type: ignore[attr-defined]

            async with session.client(
                "s3",
                endpoint_url=endpoint_url,
                aws_access_key_id=access_key,
                aws_secret_access_key=secret_key,
            ) as client:
                resp = await client.create_multipart_upload(
                    Bucket=bucket_name,
                    Key=key,
                    ContentType=content_type,
                )
                upload_id = resp["UploadId"]

                uploaded_size = 0
                async for chunk in uploaded_file.chunks(self.CHUNK_SIZE):
                    if max_size is not None and uploaded_size + len(chunk) > max_size:
                        await client.abort_multipart_upload(
                            Bucket=bucket_name, Key=key, UploadId=upload_id,
                        )
                        raise ValueError(f"File size {uploaded_size} exceeds limit {max_size}")

                    part = await client.upload_part(
                        Bucket=bucket_name,
                        Key=key,
                        PartNumber=part_number,
                        UploadId=upload_id,
                        Body=chunk,
                    )

                    parts_info.append({"PartNumber": part_number, "ETag": part["ETag"]})  # type: ignore[literal-required]
                    part_number += 1
                    uploaded_size += len(chunk)

                await client.complete_multipart_upload(
                    Bucket=bucket_name,
                    Key=key,
                    UploadId=upload_id,
                    MultipartUpload={"Parts": parts_info},
                )

            return True

        # Fallback: raw bytes
        data = uploaded_file if isinstance(uploaded_file, (bytes, bytearray)) else uploaded_file.read()  # type: ignore[union-attr]
        return storage.upload(key, data)  # type: ignore[attr-defined,no-untyped-call]

    async def upload_to_storage(self, key: str, data: bytes) -> bool:
        """Upload file to cloud storage via django-storages service layer."""
        from core.storage.services import StorageService as _Storage
        return _Storage.upload(key, data)  # type: ignore[no-any-return]

    async def download_from_storage(self, key: str) -> bytes | None:
        """Download file from cloud storage via django-storages service layer."""
        from core.storage.services import StorageService as _Storage
        return await _Storage.download(key)  # type: ignore[misc]

    async def get_storage_object_size(self, key: str) -> int | None:
        """Get file size from cloud storage via django-storages service layer."""
        from core.storage.services import StorageService as _Storage
        return await _Storage.size(key)  # type: ignore[misc]

    async def delete_from_storage(self, key: str) -> bool:
        """Delete file from cloud storage via django-storages service layer."""
        from core.storage.services import StorageService as _Storage
        return await _Storage.delete(key)  # type: ignore[misc]

    async def create_file_record(
        self,
        storage_key: str,
        filename: str,
        size: int,
        expires_at,
        expire_after_n_download: int = 10,
        number_of_files: int | None = None,
    ):
        from apps.files.models import FileRecord as _File

        record = await _File.objects.acreate(
            key=storage_key,
            filename=filename,
            size=size,
            expires_at=expires_at,
            expire_after_n_download=expire_after_n_download,
            number_of_files=number_of_files or 1,
        )

        return record

    async def get_file_by_id(self, file_id: _UUID):
        from apps.files.models import FileRecord as _File

        try:
            return await _File.objects.aget(id=file_id)
        except _File.DoesNotExist:
            return None

    async def get_file_by_key(self, key: str):
        from apps.files.models import FileRecord as _File

        try:
            return await _File.objects.aget(key=key)
        except _File.DoesNotExist:
            return None

    async def get_paginated_files(
        self,
        page: int = 1,
        page_size: int = 10,
    ) -> tuple[list, dict]:
        from apps.files.models import FileRecord as _File

        qs = _File.objects.all().order_by("-id")
        total = await qs.acount()
        offset = (page - 1) * page_size
        items = [r async for r in qs[offset : offset + page_size]]

        return items, {
            "total": total,
            "page": page,
            "page_size": min(page_size, max(1, total)),
            "pages": max(1, (total + page_size - 1) // page_size),
        }

    async def delete_file_record(self, record):
        await record.adelete()

    async def increment_download_count(self, record):
        record.download_count += 1  # type: ignore[operator]
        await record.asave(update_fields=["download_count"])
        return record.download_count  # type: ignore[return-value]

    @staticmethod
    def check_expiration(record) -> bool:
        return hasattr(record, "is_expired") and record.is_expired  # type: ignore[no-any-return]

    async def delete_file_admin(self, file_id: _UUID) -> tuple[Any, str]:
        """Delete a file record and schedule async S3 deletion via django-tasks."""
        from apps.files.models import FileRecord as _File
        from apps.files.tasks import delete_file_storage_task

        try:
            record = await _File.objects.aget(id=file_id)  # type: ignore[arg-type]
        except _File.DoesNotExist:
            return None, ""

        storage_key = record.key

        # Schedule async S3 deletion via django-tasks
        await delete_file_storage_task.schedule(args=[storage_key])

        await record.adelete()

        return record, storage_key

    @staticmethod
    def stream_file_iterator(key: str, chunk_size: int = 8192):
        """Yield chunks of file data for streaming responses."""
        from core.storage.services import StorageService as _Storage
        return _Storage.stream_file_iterator(key, chunk_size)  # type: ignore[attr-defined,no-untyped-call]
