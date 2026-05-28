"""WebSocket state channel using Django's cache/redis."""

from __future__ import annotations

import json
import logging
from typing import Any

from django.core.cache import cache  # noqa: F401


logger = logging.getLogger(__name__)


class StateWebSocketManager:
    """Manages WebSocket connections to the /ws/state endpoint."""

    def __init__(self) -> None:
        from django.conf import settings as dj_settings  # noqa: F401

        self._channel = getattr(dj_settings, "STATE_CHANNEL", "chithi:state_changed")
        self._clients: list[Any] = []

    def connect(self, ws: Any) -> None:
        self._clients.append(ws)

    def disconnect(self, ws: Any) -> None:
        if ws in self._clients:
            self._clients.remove(ws)

    async def publish(self, message: str) -> None:
        """Publish a state change via pub/sub."""
        from django.core.cache import caches

        try:
            client_cache = caches["default"]
            conn = await client_cache.aconnection()  # type: ignore[union-attr]
            pubsub = conn.pubsub()  # type: ignore[attr-defined]
            await pubsub.subscribe(self._channel)  # type: ignore[attr-defined]
            await pubsub.publish(self._channel, message.encode())  # type: ignore[attr-defined]
        except Exception:
            logger.exception("Failed to publish state change")


async def state_websocket_endpoint(ws: Any, **kwargs: Any) -> None:  # noqa: F811
    """ASGI WebSocket endpoint for /ws/state."""
    manager = StateWebSocketManager()

    try:
        await ws.accept()  # type: ignore[attr-defined]
        manager.connect(ws)

        from django.core.cache import caches

        client_cache = caches["default"]
        conn = await client_cache.aconnection()  # type: ignore[union-attr]
        pubsub = conn.pubsub()  # type: ignore[attr-defined]
        from django.conf import settings as dj_settings  # noqa: F401

        channel = getattr(dj_settings, "STATE_CHANNEL", "chithi:state_changed")
        await pubsub.subscribe(channel)  # type: ignore[attr-defined]

        try:
            while True:
                message = await ws.receive_text()  # type: ignore[attr-defined]
                try:
                    data = json.loads(message)
                    if data.get("type") == "state_patch":
                        patch_data = data.get("data", {})
                        for k, v in patch_data.items():
                            await cache.aset(k, v)  # type: ignore[union-attr]
                except json.JSONDecodeError:
                    continue
        except Exception:
            pass

    finally:
        manager.disconnect(ws)


_state_manager: StateWebSocketManager | None = None


def get_state_websocket_manager() -> StateWebSocketManager:
    global _state_manager
    if _state_manager is None:
        _state_manager = StateWebSocketManager()
    return _state_manager
