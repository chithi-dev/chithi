import asyncio
import contextlib
import logging

from fastapi import WebSocket, WebSocketDisconnect
from redis.asyncio.client import PubSub

from app.settings import settings
from app.singletons.redis import RedisClient
from app.states.app import AppState

logger = logging.getLogger(__name__)


class WebSocketManager:
    def __init__(self) -> None:
        self._connections: set[WebSocket] = set()
        self._pubsub: PubSub | None = None
        self._listener_task: asyncio.Task[None] | None = None

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self._connections.add(ws)
        # Send current state snapshot on connect
        state = await AppState.get()
        await ws.send_text(state.model_dump_json())

    def disconnect(self, ws: WebSocket) -> None:
        self._connections.discard(ws)

    async def broadcast(self, state: AppState) -> None:
        """Send serialised state to every WebSocket connected to *this* instance."""
        payload = state.model_dump_json()
        stale: list[WebSocket] = []
        for ws in self._connections:
            try:
                await ws.send_text(payload)
            except WebSocketDisconnect, RuntimeError:
                stale.append(ws)
        for ws in stale:
            self._connections.discard(ws)

    async def start(self) -> None:
        """Subscribe to the state channel and start the background listener."""
        redis_client = RedisClient.get()
        self._pubsub = redis_client.pubsub()
        await self._pubsub.subscribe(settings.STATE_CHANNEL)
        self._listener_task = asyncio.create_task(self._listen())

    async def stop(self) -> None:
        """Unsubscribe and cancel the background listener."""
        if self._listener_task is not None:
            self._listener_task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._listener_task
        if self._pubsub is not None:
            await self._pubsub.unsubscribe(settings.STATE_CHANNEL)
            await self._pubsub.aclose()

    async def _listen(self) -> None:
        """Read messages from Redis pub/sub and broadcast to local clients."""
        assert self._pubsub is not None
        async for message in self._pubsub.listen():
            if message["type"] != "message":
                continue
            try:
                state = AppState.model_validate_json(message["data"])
            except Exception:
                logger.exception("Invalid state payload on pub/sub channel")
                continue
            await self.broadcast(state)
