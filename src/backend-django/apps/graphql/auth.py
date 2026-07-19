"""JWT authentication bridge for Strawberry GraphQL.

The frontend sends Bearer JWT tokens. This module resolves the user from
the JWT token and sets it on the Django request so Strawberry's
info.context.request.user returns the correct user.
"""

from django.contrib.auth.models import AbstractBaseUser
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.tokens import RefreshToken, TokenError


def get_user_from_jwt_token(token_string: str) -> AbstractBaseUser | None:
    """Resolve a user from a JWT access token string."""
    try:
        validator = JWTAuthentication()
        validated_token = validator.get_validated_token(token_string.encode())
        return validator.get_user(validated_token)
    except TokenError:
        return None
    except Exception:
        return None


def refresh_access_token(refresh_token_string: str) -> str | None:
    """Exchange a refresh token for a new access token."""
    try:
        refresh = RefreshToken(refresh_token_string)
        return str(refresh.access_token)
    except TokenError:
        return None


def generate_tokens_for_user(user: AbstractBaseUser) -> tuple[str, str]:
    """Generate access and refresh tokens for a user."""
    refresh = RefreshToken.for_user(user)
    return str(refresh.access_token), str(refresh)
