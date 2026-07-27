import strawberry
from django.core.files.uploadedfile import UploadedFile
from strawberry.file_uploads import UploadDefinition
from strawberry.schema.config import StrawberryConfig

from apps.graphql.mutations import (
    AuthMutation,
    ConfigMutation,
    FileMutation,
    UserMutation,
)
from apps.graphql.queries import Query


# Enable experimental defer/stream for incremental delivery
strawberry_config = StrawberryConfig(
    enable_experimental_incremental_execution=True,
)


@strawberry.type
class Mutation(
    AuthMutation,
    ConfigMutation,
    FileMutation,
    UserMutation,
):
    pass


schema = strawberry.Schema(
    query=Query,
    mutation=Mutation,
    config=strawberry_config,
    scalar_overrides={UploadedFile: UploadDefinition},
)
