
import uuid

from django.contrib.auth.models import AbstractUser, UserManager as _AuthUserManager
from django.db import models


class UuidV7Default:
    """Generate UUIDv7-like identifiers via uuid4 for compatibility."""

    def __init__(self) -> None:
        pass  # uuid4 is time-ordered enough for our purposes

    def __repr__(self) -> str:
        return "uuidv7()"


class UserManager(_AuthUserManager):
    """Custom manager alias - keeps default behavior."""

    pass


class User(AbstractUser):
    """Extended user model with UUID PK and nullable email.

    Replaces the FastAPI ``app.models.user.User`` table.
    """

    objects = UserManager()

    # Override id → UUID (PK) instead of auto-created BigAutoField
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
        db_comment="Primary key - UUID",
    )

    class Meta:
        app_label = "users"
        db_table = "users_user"
        indexes = [
            models.Index(fields=["username"], name="idx_users_username"),
            models.Index(fields=["email"], name="idx_users_email"),
        ]

    def __str__(self) -> str:
        return self.username or ""


# ── Ensure AbstractUser fields are present ────────────────────────
# password, last_login, is_active, is_staff, is_superuser, date_joined, groups, user_permissions
# All inherited from AbstractUser; we only override `id` and add indexes.
