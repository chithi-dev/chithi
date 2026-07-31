import strawberry
from asgiref.sync import sync_to_async
from django.contrib.auth import get_user_model
from strawberry.types import Info

from apps.graphql.types import UserType


@strawberry.type
class UserQuery:
    # ── Users ──
    @strawberry.field
    async def users(self) -> list[UserType]:
        User = get_user_model()
        return await sync_to_async(list)(User.objects.all())

    @strawberry.field
    async def me(self, info: Info) -> UserType | None:
        user = info.context.request.user
        return user if user and user.is_authenticated else None
