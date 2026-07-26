import strawberry
from django.contrib.auth import get_user_model
from strawberry.types import Info

from apps.graphql.types import UserType


@strawberry.type
class UserQueries:
    """User-related queries."""

    @strawberry.field
    def users(self) -> list[UserType]:
        return list(get_user_model().objects.all())

    @strawberry.field
    def me(self, info: Info) -> UserType | None:
        user = info.context.request.user
        return user if user and user.is_authenticated else None
