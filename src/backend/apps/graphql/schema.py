import strawberry
from strawberry.file_uploads import UploadDefinition
from strawberry.schema.config import StrawberryConfig

from apps.graphql.mutations import (
    AuthMutation,
    ConfigMutation,
    FileMutation,
    UserMutation,
)
from apps.graphql.queries import (
    ConfigQuery,
    FileQuery,
    InstanceQuery,
    OnboardingQuery,
    UserQuery,
)

strawberry_config = StrawberryConfig(
    auto_camel_case=True,
)


@strawberry.type
class Query(
    ConfigQuery,
    FileQuery,
    InstanceQuery,
    OnboardingQuery,
    UserQuery,
):
    pass


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
)
