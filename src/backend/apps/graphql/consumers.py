import logging

import strawberry
from asgiref.sync import sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.db.models import Sum
from django.utils import timezone

from apps.config.models import Config
from apps.files.models import File

logger = logging.getLogger(__name__)

STATE_GROUP = "app_state"


@strawberry.type
class ActiveUpload:
    upload_key: str
    filename: str
    uploaded_bytes: int
    done: bool


@strawberry.type
class AppStateType:
    total_space_used: int
    total_available_space: int | None
    active_uploads: list[ActiveUpload]


class StateConsumer(AsyncJsonWebsocketConsumer):
    """Broadcasts app state (storage usage, active uploads) to all connected clients.

    Every client connecting to ws/state joins the STATE_GROUP.
    The server pushes state snapshots whenever storage changes.
    Works in single-process mode (in-memory layer) and behind a cluster (Redis).
    """

    async def connect(self):
        await self.accept()
        # Send initial state immediately
        state = await _compute_state_standalone()
        await self.send_json(state)
        # Then join the group for future broadcasts
        await self.channel_layer.group_add(STATE_GROUP, self.channel_name)

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(STATE_GROUP, self.channel_name)

    async def receive_json(self, content):
        # State is server-pushed only; no client messages expected
        pass

    async def state_update(self, event):
        """Handler called when a state_update message arrives on the group."""
        await self.send_json(event["data"])

    async def _broadcast_state(self):
        """Push current state to all connected clients."""
        state = await _compute_state_standalone()
        await self.channel_layer.group_send(
            STATE_GROUP,
            {"type": "state_update", "data": state},
        )


async def broadcast_state():
    """Call this after any storage change to push a state update to all clients.

    Usage:
        await broadcast_state()
    """
    from channels.layers import get_channel_layer

    layer = get_channel_layer()
    state = await _compute_state_standalone()
    await layer.group_send(
        STATE_GROUP,
        {"type": "state_update", "data": state},
    )


async def _compute_state_standalone() -> dict:
    """Compute the current app state snapshot (standalone — no consumer needed)."""
    def _query():
        used = File.objects.filter(expires_at__gt=timezone.now()).aggregate(
            total=Sum("size")
        )["total"] or 0
        try:
            config = Config.load()
            storage_limit = config.total_storage_limit
        except Config.DoesNotExist:
            storage_limit = None
        remaining = (storage_limit - used) if storage_limit is not None else None
        return {
            "total_space_used": used,
            "total_available_space": remaining,
            "active_uploads": [],
        }

    return await sync_to_async(_query)()
