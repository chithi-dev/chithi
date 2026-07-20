import strawberry
import strawberry_django
from django.contrib.auth import get_user_model
from strawberry.types import Info

from apps.graphql.types import UserType


@strawberry.type
class UserMutations:
    @strawberry_django.mutation
    def create_user(
        self,
        info: Info,
        username: str,
        password: str,
        email: str | None = None,
    ) -> UserType:
        User = get_user_model()
        user = User.objects.create_user(
            username=username, password=password, email=email
        )
        return user

    @strawberry_django.mutation
    def update_user(
        self,
        info: Info,
        id: strawberry.ID,
        username: str | None = None,
        email: str | None = None,
    ) -> UserType:
        User = get_user_model()
        user = User.objects.get(id=id)
        if username is not None:
            user.username = username
        if email is not None:
            user.email = email
        user.save()
        return user

    @strawberry_django.mutation
    def delete_user(self, info: Info, id: strawberry.ID) -> bool:
        User = get_user_model()
        User.objects.filter(id=id).delete()
        return True
