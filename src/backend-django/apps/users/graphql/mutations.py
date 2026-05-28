"""User mutations — login, onboard, create, update, delete."""

from __future__ import annotations

import strawberry
from uuid import UUID as _UUID

from core.auth.jwt_auth import (
    create_access_token, set_auth_cookie, clear_auth_cookie,
)

from apps.users.graphql.types import (
    LoginResult, OnboardingStatus, UserOut,
)
from apps.users.services.user_service import UserInfoService


@strawberry.type
class UsersMutations:
    @strawberry.mutation
    async def login(
        self,
        info: strawberry.types.Info,
        username: str,
        password: str,
    ) -> LoginResult:
        """Authenticate user and set JWT cookie on response."""
        service = UserInfoService()

        if not await service.authenticate(username, password):  # type: ignore[arg-type]
            raise PermissionError("Invalid username/email or password")

        from apps.users.models import User as UserModel
        user = await UserModel.objects.aget(  # type: ignore[attr-defined]
            username=username
        )

        token = create_access_token(user.id)  # type: ignore[name-defined]
        set_auth_cookie(info.context.response, token)  # type: ignore[attr-defined]

        return LoginResult(access_token=token)


    @strawberry.mutation
    async def onboard(
        self,
        info: strawberry.types.Info,
        username: str,
        email: str | None = None,
        password: str | None = None,
    ) -> OnboardingStatus:
        """Create the first admin user and set JWT cookie."""
        service = UserInfoService()

        if await service.check_onboarding():  # type: ignore[arg-type]
            raise ValueError("Onboarding already completed")

        if not password:
            raise ValueError("Password is required for onboarding")

        from apps.users.models import User as UserModel
        user = await service.onboard(username, email, password)  # type: ignore[arg-type]

        token = create_access_token(user.id)  # type: ignore[name-defined]
        set_auth_cookie(info.context.response, token)  # type: ignore[attr-defined]

        return OnboardingStatus(onboarded=True)


    @strawberry.mutation
    async def logout(self, info: strawberry.types.Info) -> bool:  # noqa: A003 - intentional shadowing
        """Clear JWT cookie from response."""
        clear_auth_cookie(info.context.response)  # type: ignore[attr-defined]
        return True


@strawberry.type
class Mutation(UsersMutations):
    pass
