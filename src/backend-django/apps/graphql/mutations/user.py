import strawberry
from asgiref.sync import sync_to_async
from django.contrib.auth import get_user_model

from apps.graphql.types import UserType


@strawberry.type
class UserMutation:
    @strawberry.mutation
    async def create_user(
        self,
        username: str,
        password: str,
        email: str | None = None,
    ) -> UserType:
        User = get_user_model()
        return await sync_to_async(User.objects.create_user)(
            username=username,
            email=email or "",
            password=password,
        )

    @strawberry.mutation
    async def update_user(
        self,
        user_id: strawberry.ID,
        username: str | None = None,
        email: str | None = None,
        is_staff: bool | None = None,
        is_active: bool | None = None,
    ) -> UserType:
        User = get_user_model()
        user = await sync_to_async(User.objects.get)(id=user_id)
        if username is not None:
            user.username = username
        if email is not None:
            user.email = email
        if is_staff is not None:
            user.is_staff = is_staff
        if is_active is not None:
            user.is_active = is_active
        await sync_to_async(user.save)()
        return user

    @strawberry.mutation
    async def delete_user(self, user_id: strawberry.ID) -> bool:
        User = get_user_model()
        try:
            user = await sync_to_async(User.objects.get)(id=user_id)
            await sync_to_async(user.delete)()
            return True
        except User.DoesNotExist:
            return False
