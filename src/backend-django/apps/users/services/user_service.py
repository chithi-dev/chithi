from uuid import UUID
from django.db.models import Q
from pwdlib import PasswordHash
from pwdlib.hashers.argon2 import Argon2Hasher

_hasher = PasswordHash((Argon2Hasher(),))


class UserInfoService:
    @classmethod
    async def authenticate(cls, username_or_email: str, password: str):
        from apps.users.models import User

        try:
            user = await User.objects.aget(Q(username=username_or_email) | Q(email=username_or_email))  # type: ignore[return-value]
        except User.DoesNotExist:
            return None

        if _hasher.verify(password, user.password):
            return user
        return None

    @classmethod
    async def create_access_token(cls, user_id: UUID) -> str:
        from core.auth.jwt_auth import create_access_token as _make

        return _make(user_id)  # type: ignore[attr-defined]

    @staticmethod
    async def check_onboarding() -> bool:
        from apps.users.models import User

        return await User.objects.acount() > 0

    @staticmethod
    async def onboard(username: str, email: str | None, password: str):
        from apps.users.models import User

        if await User.objects.acount() > 0:
            raise ValueError("Onboarding already completed")

        return await User.objects.acreate(  # type: ignore[return-value]
            username=username, email=email, password=_hasher.hash(password))

    @staticmethod
    async def get_user_by_id(user_id: UUID):
        from apps.users.models import User

        try:
            return await User.objects.aget(id=user_id)  # type: ignore[return-value]
        except User.DoesNotExist:
            return None

    @staticmethod
    async def create_user(username: str, email: str | None, password: str):
        from apps.users.models import User

        if await User.objects.filter(username=username).aexists():
            raise ValueError("Username already taken")

        return await User.objects.acreate(  # type: ignore[return-value]
            username=username, email=email, password=_hasher.hash(password))

    @staticmethod
    async def delete_user(user_id: UUID):
        from apps.users.models import User

        try:
            user = await User.objects.aget(id=user_id)
        except User.DoesNotExist:
            raise ValueError(f"User {user_id} not found")

        await user.adelete()
        return user  # type: ignore[return-value]

    @staticmethod
    def verify_password(plain: str, hashed: str) -> bool:
        return _hasher.verify(plain, hashed)
