import asyncio

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.deps import RedisDep
from app.settings import settings
from app.states.app import AppState

router = APIRouter()


@router.websocket("/ws/state")
async def state_ws(ws: WebSocket, redis_client: RedisDep):
    manager = ws.app.state.ws_manager

    await manager.connect(ws)
    pubsub = redis_client.pubsub()
    await pubsub.subscribe(settings.STATE_CHANNEL)

    async def _listen():
        try:
            async for message in pubsub.listen():
                if message["type"] == "message":
                    await ws.send_text(message["data"])
        except (asyncio.CancelledError, WebSocketDisconnect):
            pass
        except Exception:
            # log error or ignore
            pass

    listen_task = asyncio.create_task(_listen())

    try:
        # Send current state snapshot on connect
        current = await AppState.get()
        await ws.send_text(current.model_dump_json())

        # Keep the connection alive - read (and discard) client pings/messages
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        listen_task.cancel()
        await pubsub.unsubscribe(settings.STATE_CHANNEL)
        await pubsub.aclose()
        manager.disconnect(ws)
