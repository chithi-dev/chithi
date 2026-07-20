"""User model for authentication."""

from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.db import models

from mixins.models.fields import CreatedAtMixin, UUIDPrimaryKeyMixin

from .manager import UserManager


class User(UUIDPrimaryKeyMixin, CreatedAtMixin, AbstractBaseUser, PermissionsMixin):
    """Custom user model replacing Django's default."""

    username = models.CharField(max_length=150, unique=True, db_index=True)
    email = models.EmailField(null=True, blank=True, unique=True, db_index=True)

    USERNAME_FIELD = "username"
    REQUIRED_FIELDS = []

    objects = UserManager()

    def __str__(self) -> str:
        return self.username

    class Meta:
        ordering = ["-id"]
