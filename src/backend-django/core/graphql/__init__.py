"""Root GraphQL schema — assembles all domain app types into a single Strawberry schema.

Every Query and Mutation type from every domain app is composed here.
This file is the single source of truth for the entire API contract.
"""

import strawberry

from apps.admin_domain.graphql.mutations import AdminMutations
from apps.admin_domain.graphql.queries import AdminQueries
from apps.config.graphql.mutations import ConfigMutations
from apps.config.graphql.queries import ConfigQueries
from apps.files.graphql.mutations import FilesMutations
from apps.files.graphql.queries import FilesQueries
from apps.instance.graphql.queries import InstanceQueries
from apps.reverse_rooms.graphql.mutations import ReverseRoomsMutations
from apps.reverse_rooms.graphql.queries import ReverseRoomsQueries
from apps.speedtest.graphql.mutations import SpeedtestMutations
from apps.speedtest.graphql.queries import SpeedtestQueries
from apps.users.graphql.mutations import UsersMutations
from apps.users.graphql.queries import UsersQueries


@strawberry.type
class Query(
    UsersQueries,
    FilesQueries,
    ConfigQueries,
    ReverseRoomsQueries,
    SpeedtestQueries,
    InstanceQueries,
    AdminQueries,
):
    pass


@strawberry.type
class Mutation(
    UsersMutations,
    FilesMutations,
    ConfigMutations,
    ReverseRoomsMutations,
    SpeedtestMutations,
    AdminMutations,
):
    pass


schema = strawberry.Schema(query=Query, mutation=Mutation)
