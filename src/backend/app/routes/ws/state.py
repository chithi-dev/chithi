from typing import TYPE_CHECKING

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

if TYPE_CHECKING:
    from app.managers.websocket import WebSocketManager
router = APIRouter()


@router.websocket("/ws/state")
async def state_ws(ws: WebSocket):
    manager: WebSocketManager = ws.app.state.ws_manager

    try:
        await manager.connect(ws)
        # Keep the connection alive
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(ws)
