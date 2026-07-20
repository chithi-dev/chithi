import strawberry
import strawberry_django

from apps.files.models import File
from apps.graphql.types import FileType


@strawberry.type
class FileQueries:
    @strawberry_django.field
    def files(self) -> list[FileType]:
        return list(File.objects.all())

    @strawberry.field
    def file_info(self, slug: str) -> FileType | None:
        """Look up a single file by its S3 key (slug)."""
        return File.objects.filter(key=slug).first()
