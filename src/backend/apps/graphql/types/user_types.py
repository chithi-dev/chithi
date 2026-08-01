from datetime import datetime

import strawberry
from strawberry_django import type

from apps.users.models import User


@type(model=User)
class UserType:
    id: strawberry.ID
    username: str
    email: str | None
    created_at: datetime
