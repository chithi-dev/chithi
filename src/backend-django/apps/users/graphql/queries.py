from __future__ import annotations

import strawberry
from typing import List

from core.auth.jwt_auth import get_current_user as _get_current_user

from apps.users.graphql.types import UserOut, OnboardingStatus
from apps.users.services.user_service import UserInfoService


@strawberry.type
class UsersQueries:
    @strawberry.field
    async def users(
        self,
        info: strawberry.types.Info,
        page: int = 1,
        page_size: int = 10,
    ) -> List[UserOut]:
        """Paginated list of all users (auth required)."""
        await UserInfoService.require_auth(info)  # type: ignore[arg-type]
        service = UserInfoService()
        items, meta = await service.get_users(page=page, page_size=page_size)
        return [UserOut(id=u.id, username=u.username, email=u.email) for u in items]

    @strawberry.field
    async def user(self, info: strawberry.types.Info) -> UserOut:
        """Current authenticated user (auth required). Reads JWT from cookie."""
        user = await _get_current_user(info)
        if not user:
            raise PermissionError("Authentication required")
        return UserOut(id=user.id, username=user.username, email=user.email)

    @strawberry.field
    async def onboarding(self) -> OnboardingStatus:
        """Check if the instance has been onboarded (no auth)."""
        service = UserInfoService()
        return OnboardingStatus(onboarded=await service.check_onboarding())


@strawberry.type
class Query(UsersQueries):
    pass  # top-level Query will be assembled in schema.py
