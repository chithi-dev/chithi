from __future__ import annotations

import datetime
import uuid as _uuid

import strawberry


@strawberry.type
class FilesMutations:
    @strawberry.mutation
    async def upload(
        self, info: strawberry.types.Info, filename: str | None = None, expire_after_n_download: int = 10, number_of_files: int = 1
    ) -> "UploadResult":  # type: ignore[name-defined]
        from apps.config.models import Config as _ConfigModel
        from apps.files.graphql.types import UploadResult as _UploadResult

        request = info.context.get("request")
        raw_body = getattr(request, "_body", None) or getattr(request, "body", b"")

        upload_filename = filename or str(_uuid.uuid7())
        storage_key = str(_uuid.uuid7())

        from core.multipart import get_multipart_content_type, parse_multipart_body

        headers = getattr(request, "headers_dict", {}) or {}
        ct = get_multipart_content_type(getattr(request, "scope", {}).get("headers", [])) or headers.get("content-type", "")

        files_data: dict | None = None
        if raw_body and ("boundary" in str(ct) or ct):
            parsed = parse_multipart_body(raw_body, ct)  # type: ignore[arg-type]
            files_data = parsed.get("files")

        file_content = (None if not files_data else files_data["file"][1]) if files_data and "file" in files_data else raw_body
        if not file_content or len(file_content) == 0:
            raise ValueError("No file provided")

        cfg = await _ConfigModel.get_config()  # type: ignore[attr-defined]
        expires_at = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(seconds=getattr(cfg, "default_expiry", 604800) or 604800)

        if len(file_content) > 5 * 1024 * 1024:
            from apps.files.services.file_service import FileService as _FS

            await _FS().upload_to_storage_chunked(storage_key, file_content)  # type: ignore[union-attr]
        else:
            from core.storage.services import StorageService

            StorageService.upload(storage_key, file_content)  # type: ignore[attr-defined,no-untyped-call]

        from apps.files.models import FileRecord as _File

        record = await _File.objects.acreate(  # type: ignore[return-value]
            key=storage_key, filename=upload_filename, size=len(file_content), expires_at=expires_at,
            expire_after_n_download=expire_after_n_download or 10, number_of_files=max(1, number_of_files))

        return _UploadResult(key=record.key)

    @strawberry.mutation
    async def delete_file(self, info: strawberry.types.Info, file_id: strawberry.ID) -> "DeleteResult":  # type: ignore[name-defined]
        from apps.files.graphql.types import DeleteResult as _DeleteResult
        from apps.files.models import FileRecord as _File

        try:
            record = await _File.objects.aget(id=_uuid.UUID(file_id))
        except _File.DoesNotExist:
            raise ValueError(f"File {file_id} not found")

        storage_key = record.key
        from apps.files.tasks import delete_file_storage_task

        await delete_file_storage_task.aenqueue(storage_key)
        await record.adelete()
        return _DeleteResult(key=storage_key)

    @strawberry.mutation
    async def download_stream(self, info: strawberry.types.Info, key: str) -> "DownloadMeta":  # type: ignore[name-defined]
        from apps.files.graphql.types import DownloadMeta as _DownloadMeta
        from apps.files.models import FileRecord as _File

        try:
            record = await _File.objects.aget(key=key)
        except _File.DoesNotExist:
            raise ValueError(f"File with key={key} not found")

        if hasattr(record, "is_expired") and record.is_expired:
            raise PermissionError("File has expired")

        from apps.files.models import FileRecord as _FR
        await _FR.objects.filter(pk=record.pk).aupdate(download_count=record.download_count + 1)

        from django.http import StreamingHttpResponse as _SH

        response = _SH(content=__import__("core.storage.services", fromlist=["StorageService"]).StorageService.stream_file_iterator(key))  # type: ignore[attr-defined]
        response["Content-Disposition"] = f'attachment; filename="{record.filename}"'  # type: ignore[union-attr]

        return _DownloadMeta(filename=record.filename, size=int(record.size))


@strawberry.type
class Mutation(FilesMutations):
    pass
