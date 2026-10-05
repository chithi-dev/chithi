from django.contrib.auth.models import AbstractBaseUser, BaseUserManager


class UserManager(BaseUserManager):
    """Manager for creating users and superusers."""

    def create_user(
        self,
        username: str,
        password: str | None = None,
        email: str | None = None,
        **extra_fields: bool | str,
    ) -> AbstractBaseUser:
        if not username:
            raise ValueError("Username is required")
        user = self.model(username=username, email=email, **extra_fields)
        user.set_password(password)
        user.save()
        return user

    def create_superuser(
        self,
        username: str,
        password: str | None = None,
        email: str | None = None,
        **extra_fields: bool | str,
    ) -> AbstractBaseUser:
        extra_fields["is_superuser"] = True
        extra_fields["is_staff"] = True
        return self.create_user(username, password, email, **extra_fields)
