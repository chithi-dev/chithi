import strawberry

from apps.files.models import File
from apps.graphql.types import FileType


@strawberry.type
class FileQueries:
    """Public file queries."""

    @strawberry.field
    def files(self) -> list[FileType]:
        return list(File.objects.all())

    @strawberry.field
    def file_info(self, key: str) -> FileType | None:
        try:
            return File.objects.get(key=key)
        except File.DoesNotExist:
            return None
