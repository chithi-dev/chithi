import strawberry

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


schema = strawberry.Schema(query=Query, mutation=Mutation)
