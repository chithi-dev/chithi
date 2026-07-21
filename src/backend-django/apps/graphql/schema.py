import strawberry
from django.core.files.uploadedfile import UploadedFile
from strawberry.file_uploads import UploadDefinition

from apps.graphql.mutations import (
    AuthMutations,
    ConfigMutations,
    FileMutations,
    UserMutations,
)
from apps.graphql.queries import (
    AdminQueries,
    ConfigQueries,
    FileQueries,
    InstanceQueries,
    OnboardingQueries,
    UserQueries,
)


class Query(
    AdminQueries,
    ConfigQueries,
    FileQueries,
    InstanceQueries,
    OnboardingQueries,
    UserQueries,
):
    pass


class Mutation(
    AuthMutations,
    ConfigMutations,
    FileMutations,
    UserMutations,
):
    pass


schema = strawberry.Schema(
    query=Query,
    mutation=Mutation,
    scalar_overrides={UploadedFile: UploadDefinition},
)
