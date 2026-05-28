"""URL builder for Chithi CLI. Resolves backend/frontend URLs from env, prompts, or command-line options."""

from __future__ import annotations

import os
from urllib.parse import urljoin

import httpx
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Environment-driven settings for the CLI."""

    INSTANCE_URL: str | None = None

    model_config = BaseSettings.Config(env_prefix="CHITHI_")


_settings = Settings()


_DEFAULT_BACKEND = "http://localhost:8000"
_DEFAULT_FRONTEND = "http://localhost:5173"
_GRAPHQL_PATH = "/graphql"


def _resolve_backend_url(initial: str | None) -> tuple[str, str]:
    """Resolve backend URL and return (backend_url, frontend_url)."""
    raw = initial or _settings.INSTANCE_URL

    if not raw:
        # Try to prompt user in interactive mode
        try:
            import typer  # noqa: F401

            raw = typer.prompt("Enter Chithi instance URL", default=_DEFAULT_BACKEND)  # type: ignore[assignment]
        except Exception:  # non-interactive
            raw = _DEFAULT_BACKEND

    # Normalize trailing slashes
    backend_url = raw.rstrip("/")

    # Derive frontend URL from backend
    if not backend_url.startswith("http"):
        backend_url = "http://" + backend_url

    return backend_url, urljoin(backend_url, "/")


def resolve_graphql_url(initial: str | None) -> str:
    """Get the full GraphQL endpoint URL."""
    backend, _ = _resolve_backend_url(initial)
    return urljoin(backend, _GRAPHQL_PATH)


def share_url(slug: str, key_secret: str) -> str:
    """Build a frontend download URL with secret key fragment."""
    from cli.core.urls import resolve_frontend_url

    base = resolve_frontend_url()
    return f"{base}download/{slug}#{key_secret}"
