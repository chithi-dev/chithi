from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.states.app import AppState

router = APIRouter()


@router.websocket("/ws/state")
async def state_ws(ws: WebSocket):
    manager = ws.app.state.ws_manager

    await manager.connect(ws)
    try:
        # Send current state snapshot on connect
        current: AppState = await AppState.get()
        await ws.send_text(current.model_dump_json())

        # Keep the connection alive — read (and discard) client pings/messages
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(ws)
