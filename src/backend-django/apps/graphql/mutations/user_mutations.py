"""User management mutations for the GraphQL API."""

import strawberry
from django.contrib.auth import get_user_model
from strawberry.types import Info

from apps.graphql.types import UserType


@strawberry.type
class UserMutations:
    """User CRUD mutations."""

    @strawberry.mutation
    def create_user(self, info: Info, username: str, password: str, email: str | None = None) -> UserType:
        User = get_user_model()
        return User.objects.create_user(username=username, password=password, email=email)

    @strawberry.mutation
    def update_user(
        self,
        info: Info,
        user_id: strawberry.ID,
        username: str | None = None,
        email: str | None = None,
        is_staff: bool | None = None,
        is_active: bool | None = None,
    ) -> UserType:
        User = get_user_model()
        user = User.objects.get(id=user_id)

        for field, value in {
            "username": username,
            "email": email,
            "is_staff": is_staff,
            "is_active": is_active,
        }.items():
            if value is not None:
                setattr(user, field, value)

        user.save()
        return user

    @strawberry.mutation
    def delete_user(self, info: Info, user_id: strawberry.ID) -> bool:
        User = get_user_model()
        try:
            User.objects.get(id=user_id).delete()
            return True
        except User.DoesNotExist:
            return False
