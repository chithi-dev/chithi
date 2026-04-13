import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.managers import WebSocketManager
from app.settings import settings
from app.singletons.redis import RedisClient
from app.states.app import AppState, GlobalState


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialise shared Redis client and start periodic state sync task
    GlobalState.init_redis()

    # Prune stale uploads persisted in Redis from previous runs
    await AppState.cleanup_active_uploads()

    async def _state_sync_loop() -> None:
        try:
            while True:
                await AppState.state_sync()
                await asyncio.sleep(settings.APP_STATE_SYNC_INTERVAL)
        except asyncio.CancelledError:
            return

    state_sync_task = asyncio.create_task(_state_sync_loop())
    app.state._state_sync_task = state_sync_task

    # Start WebSocket manager pub/sub listener
    ws_manager = WebSocketManager()
    await ws_manager.start()
    app.state.ws_manager = ws_manager

    yield

    # Shutdown: stop background state sync task, then other services
    state_sync_task = getattr(app.state, "_state_sync_task", None)
    if state_sync_task is not None:
        state_sync_task.cancel()
        try:
            await state_sync_task
        except asyncio.CancelledError:
            pass

    await ws_manager.stop()
    await RedisClient.aclose()


app = FastAPI(
    root_path=settings.ROOT_PATH,
    openapi_url="/openapi.json",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

from app.routes.http.admin.config import router as admin_config_router

app.include_router(admin_config_router, prefix="/admin")

from app.routes.http.admin.user import router as admin_user_router

app.include_router(admin_user_router, prefix="/admin")

from app.routes.http.admin.files import router as admin_file_router

app.include_router(admin_file_router, prefix="/admin")

from app.routes.http.config import router as config_router

app.include_router(config_router)

from app.routes.http.login import router as login_router

app.include_router(login_router)

from app.routes.http.user import router as user_router

app.include_router(user_router)

from app.routes.http.upload import router as upload_router

app.include_router(upload_router)

from app.routes.http.download import router as download_router

app.include_router(download_router)

from app.routes.http.information import router as information_router

app.include_router(information_router)

from app.routes.http.onboarding import router as onboarding_router

app.include_router(onboarding_router)

from app.routes.http.speedtest import router as speedtest_router

app.include_router(speedtest_router)


from app.routes.ws.state import router as ws_router

app.include_router(ws_router)

from app.routes.http.reverse import router as reverse_router

app.include_router(reverse_router)

from app.routes.ws.reverse import router as ws_reverse_router

app.include_router(ws_reverse_router)
