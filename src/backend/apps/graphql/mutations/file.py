import strawberry
from asgiref.sync import sync_to_async
from strawberry.file_uploads import Upload
from strawberry.types import Info
from uuid import uuid4
from django.utils import timezone

from apps.config.models import Config
from apps.files.models import File
from apps.files.services import delete_file_from_storage, upload_file_data
from apps.graphql.consumers import broadcast_state
from apps.graphql.types import FileType


@strawberry.type
class FileMutation:
    @strawberry.mutation
    async def upload_file(
        self,
        info: Info,
        filename: str,
        file: Upload,
        expires_at: int,
        expire_after_n_download: int,
        number_of_files: int | None = None,
    ) -> FileType:
        config = await sync_to_async(Config.load)()

        # Check if uploads are allowed
        if not config.allow_uploads:
            raise ValueError("File uploads are currently disabled.")

        # ``Upload`` is a NewType over ``bytes`` — the multipart parser
        # already materialised the file contents. If a client uses Django's
        # native multipart transport instead, the bytes will be on
        # ``request.FILES["file"]`` as an UploadedFile.
        if isinstance(file, (bytes, bytearray, memoryview)):
            file_data = bytes(file)
        elif isinstance(file, list):
            # Some multipart parsers return a list of byte chunks — concat.
            file_data = b"".join(bytes(p) for p in file)
        elif hasattr(file, "read") and callable(getattr(file, "read")):
            file_data = file.read()
        else:
            upload = info.context.request.FILES.get("file")
            if upload is None:
                raise ValueError("Uploaded file is empty.")
            file_data = upload.read()

        # The strawberry multipart parser includes the trailing CRLF
        # separator in the file bytes when the file is delivered as an
        # InMemoryUploadedFile. Strip it so the upload matches what the
        # client actually sent.
        if file_data.endswith(b"\r\n"):
            file_data = file_data[:-2]

        file_size = len(file_data)

        if file_size == 0:
            raise ValueError("Uploaded file is empty.")
        if file_size > config.max_file_size_limit:
            raise ValueError(
                f"File size {file_size} exceeds the maximum allowed size "
                f"{config.max_file_size_limit}."
            )

        if expires_at > config.default_expiry:
            raise ValueError(
                f"Expiry duration {expires_at}s exceeds the maximum allowed "
                f"{config.default_expiry}s."
            )

        key = str(uuid4())
        await upload_file_data(key=key, data=file_data)
        file_obj = await sync_to_async(File.objects.create)(
            key=key,
            filename=filename,
            size=file_size,
            expires_at=timezone.now() + timezone.timedelta(seconds=expires_at),
            expire_after_n_download=expire_after_n_download,
            number_of_files=number_of_files,
        )
        await broadcast_state()
        return file_obj

    @strawberry.mutation
    async def delete_file(self, file_id: strawberry.ID) -> bool:
        try:
            file_obj = await sync_to_async(File.objects.get)(id=file_id)
            await delete_file_from_storage(file_obj.key)
            await sync_to_async(file_obj.delete)()
            await broadcast_state()
            return True
        except File.DoesNotExist:
            return False
