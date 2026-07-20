"""File management mutations for the GraphQL API."""

from uuid import uuid4

import strawberry
from django.utils import timezone
from strawberry.types import Info

from apps.files.models import File
from apps.files.services import delete_file_from_s3, upload_file_data
from apps.graphql.types import FileType


@strawberry.type
class FileMutations:
    """File upload and deletion mutations."""

    @strawberry.mutation
    def upload_file(
        self,
        info: Info,
        filename: str,
        size: int,
        data: bytes,
        expires_at: int,
        expire_after_n_download: int,
        number_of_files: int | None = None,
    ) -> FileType:
        key = str(uuid4())
        upload_file_data(key=key, data=data)
        return File.objects.create(
            key=key,
            filename=filename,
            size=size,
            expires_at=timezone.now() + timezone.timedelta(seconds=expires_at),
            expire_after_n_download=expire_after_n_download,
            number_of_files=number_of_files,
        )

    @strawberry.mutation
    def delete_file(self, info: Info, file_id: strawberry.ID) -> bool:
        try:
            file_obj = File.objects.get(id=file_id)
            delete_file_from_s3(file_obj.key)
            file_obj.delete()
            return True
        except File.DoesNotExist:
            return False
