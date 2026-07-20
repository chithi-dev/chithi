import strawberry
import strawberry_django
from strawberry.types import Info

from apps.config.models import Config
from apps.files.models import File
from apps.files.services import delete_file_from_s3
from apps.graphql.types import FileType


@strawberry.type
class FileMutations:
    @strawberry.mutation
    def upload_file(
        self,
        info: Info,
        filename: str,
        expire_after: int,
        expire_after_n_download: int,
        number_of_files: int | None = None,
    ) -> FileType:
        """Create a File record for an upload. Actual data upload is handled via presigned URLs or separate streaming."""
        user = info.context.request.user
        if not user.is_authenticated:
            raise PermissionError("Authentication required")

        config = Config.load()

        if not config.allow_uploads:
            raise ValueError("Uploads are currently disabled")

        if config.time_configs and expire_after not in config.time_configs:
            raise ValueError(f"Invalid expiry. Choose from: {config.time_configs}")

        if config.download_configs and expire_after_n_download not in config.download_configs:
            raise ValueError(
                f"Invalid download count. Choose from: {config.download_configs}"
            )

        from django.utils import timezone
        from uuid import uuid4

        key = str(uuid4())
        now = timezone.now()

        file_obj = File.objects.create(
            key=key,
            filename=filename,
            size=0,
            number_of_files=number_of_files,
            expires_at=now + timezone.timedelta(seconds=expire_after),
            expire_after_n_download=expire_after_n_download,
            download_count=0,
        )
        return file_obj

    @strawberry_django.mutation
    def delete_file(self, info: Info, id: strawberry.ID) -> bool:
        file_obj = File.objects.filter(id=id).first()
        if file_obj:
            delete_file_from_s3(file_obj.key)
            file_obj.delete()
        return True
