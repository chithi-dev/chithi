"""Tests for JwtAuthenticationMiddleware.

Proves the Bearer JWT resolves ``request.user`` on both transports
(GraphQL and the ninja API), so auth is consistent across them.
"""

import pytest
from django.contrib.auth import get_user_model
from django.test import Client, override_settings
from django.urls import path, reverse
from ninja import NinjaAPI

from apps.graphql.auth import get_jwt_tokens


def _build_echo_urls():
    """A ninja API with one endpoint that echoes the resolved ``request.user``.

    Proves the middleware runs on plain ninja views too, not just GraphQL.
    """
    api = NinjaAPI(urls_namespace="echo")

    @api.get("/echo-user/", response=dict)
    async def echo_user(request) -> dict:
        user = request.user
        return {"username": user.username if user.is_authenticated else None}

    return [path("echo/", api.urls)]


def _authed_client(user) -> Client:
    """A test client that sends the user's access token as a Bearer header."""
    access, _ = get_jwt_tokens(user)
    return Client(HTTP_AUTHORIZATION=f"Bearer {access}")


@pytest.mark.django_db
def test_bearer_jwt_sets_user_on_graphql_me() -> None:
    """A Bearer JWT makes the GraphQL ``me`` query return the user."""
    User = get_user_model()
    user = User.objects.create_user(username="alice", password="pw")

    response = _authed_client(user).post(
        reverse("graphql"),
        data={"query": "{ me { username } }"},
        content_type="application/json",
    )
    assert response.status_code == 200
    assert response.json()["data"]["me"]["username"] == "alice"


@pytest.mark.django_db
def test_graphql_me_anonymous_without_token() -> None:
    """Without a token, ``me`` resolves to null."""
    response = Client().post(
        reverse("graphql"),
        data={"query": "{ me { username } }"},
        content_type="application/json",
    )
    assert response.status_code == 200
    assert response.json()["data"]["me"] is None


@pytest.mark.django_db
def test_bearer_jwt_sets_user_on_ninja_view() -> None:
    """The same Bearer JWT resolves ``request.user`` on a ninja endpoint."""
    User = get_user_model()
    user = User.objects.create_user(username="bob", password="pw")

    import core.urls as core_urls

    # Prepend the echo route to the real URLconf for this request.
    with override_settings(
        ROOT_URLCONF=core_urls.__name__
    ), patch_urls(core_urls, _build_echo_urls()):
        response = _authed_client(user).get("/echo/echo-user/")
    assert response.status_code == 200
    assert response.json()["username"] == "bob"


def patch_urls(module, extra_patterns):
    """Temporarily prepend ``extra_patterns`` to a URLconf module's urlpatterns."""
    import contextlib

    @contextlib.contextmanager
    def _patch():
        original = module.urlpatterns
        module.urlpatterns = extra_patterns + original
        yield
        module.urlpatterns = original

    return _patch()


def test_bearer_regex_extracts_token() -> None:
    from core.middleware import _BEARER_RE

    assert _BEARER_RE.match("Bearer abc123").group(1) == "abc123"
    # Tolerates extra whitespace and a case-insensitive scheme.
    assert _BEARER_RE.match("bearer   xyz").group(1) == "xyz"
    # Rejects non-Bearer schemes and empty tokens.
    assert _BEARER_RE.match("Basic abc123") is None
    assert _BEARER_RE.match("Bearer ") is None
    assert _BEARER_RE.match("") is None
