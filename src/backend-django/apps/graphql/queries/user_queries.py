import strawberry
import strawberry_django
from django.contrib.auth import get_user_model
from strawberry.types import Info

from apps.graphql.types import UserType


@strawberry.type
class UserQueries:
    @strawberry_django.field
    def users(self) -> list[UserType]:
        User = get_user_model()
        return list(User.objects.all())

    @strawberry.field
    def me(self, info: Info) -> UserType | None:
        user = info.context.request.user
        if not user.is_authenticated:
            return None
        return user
