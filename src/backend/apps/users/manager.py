from django.contrib.auth.models import BaseUserManager


class UserManager(BaseUserManager):
    """Manager for creating users and superusers."""

    def create_user(self, username, password=None, email=None, **extra_fields):
        if not username:
            raise ValueError("Username is required")
        user = self.model(username=username, email=email, **extra_fields)
        user.set_password(password)
        user.save()
        return user

    def create_superuser(self, username, password=None, email=None, **extra_fields):
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_staff", True)
        return self.create_user(username, password, email, **extra_fields)
