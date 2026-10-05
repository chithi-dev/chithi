"""Strawberry context — resolves the authenticated user per request.

Replaces the old ``GraphQLJwtMiddleware``: auth is a concern of the
GraphQL layer, so it lives here rather than as global middleware that
touches every route.
"""

from dataclasses import dataclass

from django.contrib.auth.models import AbstractBaseUser, AnonymousUser
from django.http import HttpRequest


@dataclass(frozen=True, slots=True)
class Context:
    request: HttpRequest
    user: AbstractBaseUser | AnonymousUser
