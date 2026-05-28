"""File mutations: upload (S3 chunked), delete, and stream download."""

from __future__ import annotations

import datetime
import logging
import uuid as _uuid

import strawberry
from django.http import StreamingHttpResponse
from strawberry.types.info import Info

from apps.files.graphql.types import DeleteResult, DownloadMeta, UploadResult
from apps.files.services.file_service import FileService
from core.multipart import get_multipart_content_type, parse_multipart_body

logger = logging.getLogger(__name__)


@strawberry.type
class FilesMutations:
    @strawberry.mutation
    async def upload(
        self,
        info: Info,
        filename: str | None = None,
        expire_after_n_download: int = 10,
        number_of_files: int = 1,
    ) -> UploadResult:
        """Upload a file via multipart form data to S3 with chunked uploads."""

        request = info.context.get("request")
        if not hasattr(request, "get"):
            raise ValueError("Invalid request context")

        raw_body = getattr(request, "_body", None) or getattr(request, "body", b"")
        headers = getattr(request, "headers_dict", {}) or {}

        upload_filename = filename or str(_uuid.uuid7())
        storage_key = str(_uuid.uuid7())

        service = FileService()
        content_type_header = get_multipart_content_type(
            request.scope.get("headers", []) if hasattr(request, "scope") else []
        )

        # Parse multipart body for the uploaded file
        files_data: dict[str, tuple[str, bytes]] | None = None
        if raw_body and (content_type_header or ("boundary" in str(headers.get("content-type", "")))):
            ct = content_type_header or headers.get("content-type")
            parsed = parse_multipart_body(raw_body, ct)  # type: ignore[arg-type]
            files_data = parsed.get("files")

        file_content: bytes | None = None
        if files_data and "file" in files_data:
            _, file_content = files_data["file"]
        elif raw_body and len(raw_body.strip()) > 0:
            file_content = raw_body

        if not file_content or len(file_content) == 0:
            raise ValueError("No file provided")

        limits = await service.validate_upload_limits(len(file_content))
        expires_at = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(
            seconds=limits["default_expiry"]
        )

        # For small files, use django-storages; for large files, chunked S3 upload
        if len(file_content) > 5 * 1024 * 1024:
            await service.upload_to_storage_chunked(storage_key, file_content)
        else:
            from core.storage.services import StorageService

            StorageService.upload(storage_key, file_content)  # type: ignore[attr-defined,no-untyped-call]

        record = await service.create_file_record(
            storage_key=storage_key,
            filename=upload_filename,
            size=len(file_content),
            expires_at=expires_at,
            expire_after_n_download=expire_after_n_download or 10,
            number_of_files=max(1, number_of_files),
        )

        return UploadResult(key=record.key)  # type: ignore[attr-defined]

    @strawberry.mutation
    async def delete_file(self, info: Info, file_id: strawberry.ID) -> DeleteResult:
        """Delete a file by ID (auth required). Schedules async deletion."""

        from core.auth.jwt_auth import get_current_user

        user = await get_current_user(info)
        if not user:
            raise PermissionError("Authentication required")

        service = FileService()
        record, storage_key = await service.delete_file_admin(_uuid.UUID(file_id))  # type: ignore[arg-type]

        if not record:
            raise ValueError(f"File {file_id} not found")

        return DeleteResult(key=storage_key)

    @strawberry.mutation
    async def download_stream(self, info: Info, key: str) -> DownloadMeta:  # noqa: A003
        """Stream file content through Django (no S3 URL exposure)."""
        service = FileService()

        record = await service.get_file_by_key(key)
        if not record:
            raise ValueError(f"File with key={key} not found")

        if service.check_expiration(record):  # type: ignore[arg-type]
            raise PermissionError("File has expired")

        await service.increment_download_count(record)  # type: ignore[union-attr]

        response = StreamingHttpResponse(
            content=service.stream_file_iterator(key),  # type: ignore[attr-defined,no-untyped-call]
            content_type="application/octet-stream",
        )
        response["Content-Disposition"] = f'attachment; filename="{record.filename}"'  # type: ignore[union-attr]

        req = info.context.get("request")
        if hasattr(req, "_streaming_response"):
            req._streaming_response = response  # type: ignore[attr-defined]

        return DownloadMeta(  # type: ignore[arg-type]
            filename=record.filename,  # type: ignore[union-attr]
            size=int(record.size),  # type: ignore[union-attr]
        )


@strawberry.type
class Mutation(FilesMutations):
    pass
