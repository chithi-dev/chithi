"""ASGI config — composites GraphQL view and WebSocket routes."""

from __future__ import annotations

import os

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")

from typing import Any, Awaitable, Callable


def _create_asgi_app() -> Callable[[Any, Any, Any], Awaitable[None]]:
    from django.conf import settings as dj_settings  # noqa: F401

    redis_url = getattr(dj_settings, "REDIS_ENDPOINT", "redis://localhost:6379/1")
    rustfs_endpoint = getattr(dj_settings, "RUSTFS_ENDPOINT_URL", "http://localhost:9000")
    bucket_name = getattr(dj_settings, "RUSTFS_BUCKET_NAME", "chithi")

    from core.auth.jwt_auth import AuthGraphQLView
    from core.graphql import schema

    graphql_app = AuthGraphQLView(schema=schema)  # type: ignore[arg-type]

    async def asgi_app(scope: Any, receive: Any, send: Any) -> None:  # noqa: F811
        if scope["type"] == "websocket":
            path = scope.get("path", "")

            if path == "/ws/state":
                from core.websockets.state import state_websocket_endpoint as _state_ws

                await _state_ws(ws=scope, redis_url=redis_url)
                return

            if (
                path.startswith("/ws/reverse/rooms/")
                and len(path.split("/")) == 5
            ):
                _, _, _, room_id = path.split("/")
                host_token: str | None = None
                qs = scope.get("query_string", b"").decode()
                for part in qs.split("&"):
                    if "=" in part:
                        k2, v2 = part.split("=", 1)
                        if k2 == "host_token":
                            from urllib.parse import unquote_plus

                            host_token = unquote_plus(v2)
                from core.websockets.reverse import (
                    reverse_room_websocket_endpoint as _reverse_ws,
                )

                await _reverse_ws(
                    ws=scope,
                    room_id=room_id,
                    redis_url=redis_url,
                    s3_endpoint=rustfs_endpoint,
                    bucket_name=bucket_name,
                    host_token_query=host_token,
                )
                return

            # Fall through to GraphQL WebSocket subscriptions.
            await graphql_app(scope, receive, send)  # type: ignore[arg-type]
            return

        # Non-WS requests go through the auth-aware GraphQL view.
        # The custom context provides info.context.request / .response for
        # cookie read/write and injects info.context.user with the authenticated
        # User (from Authorization: Bearer <token>).
        await graphql_app(scope, receive, send)  # type: ignore[arg-type]

    return asgi_app


application = _create_asgi_app()  # type: ignore[assignment]
