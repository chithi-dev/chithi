from __future__ import annotations

import strawberry


@strawberry.type
class UsersQueries:
    @strawberry.field
    async def users(
        self, info: strawberry.types.Info, page: int = 1, page_size: int = 10
    ) -> "list[UserOut]":  # type: ignore[name-defined]
        from apps.users.graphql import types as _types
        from apps.users.models import User

        user = info.context.user  # type: ignore[union-attr]
        if not user:
            raise PermissionError("Authentication required")

        qs = User.objects.all().order_by("-id")
        items = [u async for u in qs[(page - 1) * page_size : (page - 1) * page_size + page_size]]
        return [_types.UserOut(id=u.id, username=u.username, email=u.email) for u in items]

    @strawberry.field
    async def user(self, info: strawberry.types.Info) -> "UserOut":  # type: ignore[name-defined]
        from apps.users.graphql import types as _types

        user = info.context.user  # type: ignore[union-attr]
        if not user:
            raise PermissionError("Authentication required")

        return _types.UserOut(id=user.id, username=user.username, email=user.email)

    @strawberry.field
    async def onboarding(self) -> "OnboardingStatus":  # type: ignore[name-defined]
        from apps.users.graphql import types as _types
        from apps.users.models import User

        return _types.OnboardingStatus(onboarded=await User.objects.acount() > 0)


@strawberry.type
class Query(UsersQueries):
    pass
