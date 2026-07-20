"""JWT authentication utilities for Strawberry GraphQL.

Handles token creation, validation, and user resolution using PyJWT.
"""

import jwt
from django.conf import settings
from django.contrib.auth import get_user_model


def get_jwt_tokens(user) -> tuple[str, str]:
    """Generate access and refresh JWT tokens for a user."""
    from datetime import UTC, datetime, timedelta

    now = datetime.now(UTC)

    access_payload = {
        "user_id": user.id,
        "exp": now + timedelta(hours=1),
        "iat": now,
    }
    access_token = jwt.encode(access_payload, settings.SECRET_KEY, algorithm="HS512")

    refresh_payload = {
        "user_id": user.id,
        "exp": now + timedelta(days=2),
        "iat": now,
    }
    refresh_token = jwt.encode(refresh_payload, settings.SECRET_KEY, algorithm="HS512")

    return access_token, refresh_token


def get_user_from_jwt_token(token_string: str):
    """Resolve a user from a JWT access token string."""
    try:
        payload = jwt.decode(token_string, settings.SECRET_KEY, algorithms=["HS512"])
        User = get_user_model()
        return User.objects.get(id=payload["user_id"])
    except (jwt.PyJWTError, get_user_model().DoesNotExist):
        return None
