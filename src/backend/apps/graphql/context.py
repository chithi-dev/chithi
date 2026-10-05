"""Strawberry context - carries the resolved request user to resolvers.

``request.user`` is already populated by ``JwtAuthenticationMiddleware``
(session auth or Bearer JWT), so the context simply exposes it.
"""

from dataclasses import dataclass

from django.contrib.auth.models import AbstractBaseUser, AnonymousUser
from django.http import HttpRequest


@dataclass(frozen=True, slots=True)
class Context:
    request: HttpRequest
    user: AbstractBaseUser | AnonymousUser
