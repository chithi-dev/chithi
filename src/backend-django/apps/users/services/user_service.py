"""User domain service - all business logic for users."""

from uuid import UUID
from django.db.models import Q
from pwdlib import PasswordHash
from pwdlib.hashers.argon2 import Argon2Hasher
from strawberry.types.info import Info
from apps.users.models import User
_hasher = PasswordHash((Argon2Hasher(),))
class UserInfoService:
    """All user-related business logic lives here."""
    # ── Authentication ────────────────────────────────────────
    async def authenticate(self, username_or_email: str, password: str) -> User | None:
        """Look up user by username OR email and verify password via Argon2."""
        try:
            user = await User.objects.get(
                Q(username=username_or_email) | Q(email=username_or_email)
            )
        except User.DoesNotExist:
            return None
        if _hasher.verify(password, user.password):
            return user
        return None
    async def create_access_token(self, user_id: UUID) -> str:
        """Return a signed JWT access token for *user_id*."""
        from core.auth.jwt_auth import create_access_token as _make
        return _make(user_id)  # type: ignore[attr-defined]
    @classmethod
    async def get_current_user(cls, info: Info):
        """Resolve current authenticated user from request context."""
        request = info.context.get("request")
        if not hasattr(request, "user"):
            return None
        user = getattr(request, "user", None)
        if user is None or (hasattr(user, "is_anonymous") and user.is_anonymous):
            return None
        return user  # type: ignore[return-value]
    @classmethod
    async def require_auth(cls, info: Info) -> User:
        user = await cls.get_current_user(info)
        if user is None:
            raise PermissionError("Authentication required")
        return user
    # ── Onboarding ────────────────────────────────────────────
    @classmethod
    async def check_onboarding(cls) -> bool:
        """Return True if any User row exists in the database."""
        return await cls._has_users()
    @classmethod
    async def onboard(
        cls, username: str, email: str | None, password: str
    ) -> User:
        """Create the first user (only works when DB is empty)."""
        if await cls._has_users():
            raise ValueError("Onboarding already completed")
        return await User.objects.acreate(
            username=username,
            email=email,
            password=_hasher.hash(password),
        )
    @staticmethod
    async def _has_users() -> bool:
        return await User.objects.acount() > 0
    # ── User queries (paginated list) ─────────────────────────
    from django.conf import settings as dj_settings
    _MAX_PER_PAGE = getattr(dj_settings, "MAX_RESULTS_PER_PAGE", 50)
    async def get_users(
        self, page: int = 1, page_size: int = 10
    ) -> tuple[list[User], dict]:
        """Return (user_list, pagination_meta)."""
        page_size = min(page_size, self._MAX_PER_PAGE)
        qs = User.objects.all().order_by("id")
        total = await qs.acount()
        offset = (page - 1) * page_size
        items: list[User] = [u async for u in qs[offset : offset + page_size]]
        return items, {
            "total": total,
            "page": page,
            "page_size": min(page_size, total),
            "pages": max(1, (total + page_size - 1) // page_size),
        }
    # ── User CRUD (self-update, create, delete) ───────────────
    async def get_user_by_id(self, user_id: UUID) -> User | None:
        try:
            return await User.objects.aget(id=user_id)  # type: ignore[return-value]
        except User.DoesNotExist:
            return None
    async def update_current_user(
        self,
        info: Info,
        username: str | None = None,
        email: str | None = None,
    ) -> User:
        """Update the authenticated user's profile fields."""
        user = await UserInfoService.require_auth(info)  # type: ignore[arg-type]
        if username is not None and username != user.username:
            exists = await User.objects.filter(username=username).aexclude(id=user.id).aexists()
            if exists:
                raise ValueError("Username already taken")
            user.username = username
        if email is not None and email != user.email:
            exists = await User.objects.filter(email=email).aexclude(id=user.id).aexists()
            if exists:
                raise ValueError("Email already taken")
            user.email = email
        await user.asave(update_fields=[f for f in ("username", "email") if locals()[f] is not None and f != "password"] or ["updated_at"])  # type: ignore[name-defined]
        return user
    async def create_user(
        self, username: str, email: str | None, password: str
    ) -> User:
        """Create a new user (called by authenticated current user)."""
        if await User.objects.filter(username=username).aexists():
            raise ValueError("Username already taken")
        return await User.objects.acreate(
            username=username,
            email=email,
            password=_hasher.hash(password),
        )
    async def delete_user(self, user_id: UUID) -> User:
        """Delete a user by ID (called by current user on any user)."""
        try:
            user = await User.objects.aget(id=user_id)  # type: ignore[arg-type]
        except User.DoesNotExist:
            raise ValueError(f"User {user_id} not found")
        await user.adelete()
        return user  # type: ignore[return-value]
    # ── Password helpers (used by login mutations elsewhere) ──
    @staticmethod
    def verify_password(plain: str, hashed: str) -> bool:
        return _hasher.verify(plain, hashed)
    @staticmethod
    def hash_password(raw: str) -> str:
        return _hasher.hash(raw)
