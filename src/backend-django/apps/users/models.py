import uuid

from django.contrib.auth.models import AbstractUser, UserManager
from django.db import models


class User(AbstractUser):
    """Extends Django's ``AbstractUser`` with a UUID primary key.

    Inherits from AbstractUser:
        username, first_name, last_name, email, password, is_staff,
        is_active, is_superuser, date_joined, last_login, groups,
        user_permissions.
    """

    objects = UserManager()

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    # Enforce uniqueness on email (AbstractUser does not).
    class Meta:
        app_label = "users"
        db_table = "users_user"
        constraints = [
            models.UniqueConstraint(
                fields=["email"],
                name="uq_users_email",
            ),
        ]

    def __str__(self) -> str:
        return self.username or ""
