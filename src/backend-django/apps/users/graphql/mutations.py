from __future__ import annotations

import strawberry


@strawberry.type
class UsersMutations:
    @strawberry.mutation
    async def login(self, info: strawberry.types.Info, username: str, password: str) -> "LoginResult":  # type: ignore[name-defined]
        from apps.users.graphql import types as _types

        user = info.context.user  # type: ignore[union-attr]
        if not user or (hasattr(user, "is_anonymous") and user.is_anonymous):
            raise PermissionError("Invalid username/email or password")

        token = __import__("core.auth.jwt_auth", fromlist=["create_access_token"]).create_access_token(user.id)  # type: ignore[attr-defined]
        __import__("core.auth.jwt_auth", fromlist=["set_auth_cookie"]).set_auth_cookie(info.context.response, token)  # type: ignore[attr-defined]

        return _types.LoginResult(access_token=token)  # type: ignore[name-defined]

    @strawberry.mutation
    async def onboard(
        self, info: strawberry.types.Info, username: str, email: str | None = None, password: str | None = None
    ) -> "OnboardingStatus":  # type: ignore[name-defined]
        from apps.users.graphql import types as _types

        if await __import__("apps.users.models", fromlist=["User"]).User.objects.acount():
            raise ValueError("Onboarding already completed")
        if not password:
            raise ValueError("Password is required for onboarding")

        user = await __import__("apps.users.models", fromlist=["User"]).User.objects.acreate(  # type: ignore[return-value]
            username=username, email=email,
            password=__import__("pwdlib", fromlist=["PasswordHash"]).PasswordHash((__import__("pwdlib.hashers.argon2", fromlist=["Argon2Hasher"]).Argon2Hasher(),)).hash(password))

        token = __import__("core.auth.jwt_auth", fromlist=["create_access_token"]).create_access_token(user.id)  # type: ignore[attr-defined]
        __import__("core.auth.jwt_auth", fromlist=["set_auth_cookie"]).set_auth_cookie(info.context.response, token)  # type: ignore[attr-defined]

        return _types.OnboardingStatus(onboarded=True)  # type: ignore[name-defined]

    @strawberry.mutation
    async def logout(self, info: strawberry.types.Info) -> bool:
        __import__("core.auth.jwt_auth", fromlist=["clear_auth_cookie"]).clear_auth_cookie(info.context.response)  # type: ignore[attr-defined]
        return True


@strawberry.type
class Mutation(UsersMutations):
    pass
