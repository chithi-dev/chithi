from datetime import UTC, datetime, timedelta

import jwt
from django.conf import settings
from django.contrib.auth import get_user_model


def get_jwt_tokens(user) -> tuple[str, str]:
    """Generate access and refresh JWT tokens for a user."""
    now = datetime.now(UTC)

    access_token = jwt.encode(
        {"user_id": str(user.id), "exp": now + timedelta(hours=1), "iat": now},
        settings.SECRET_KEY,
        algorithm="HS512",
    )

    refresh_token = jwt.encode(
        {"user_id": str(user.id), "exp": now + timedelta(days=2), "iat": now},
        settings.SECRET_KEY,
        algorithm="HS512",
    )

    return access_token, refresh_token


def get_user_from_jwt_token(token_string: str):
    """Resolve a user from a JWT token string."""
    try:
        payload = jwt.decode(token_string, settings.SECRET_KEY, algorithms=["HS512"])
        User = get_user_model()
        return User.objects.get(id=payload["user_id"])
    except (jwt.PyJWTError, User.DoesNotExist):
        return None
