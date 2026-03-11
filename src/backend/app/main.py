from contextlib import asynccontextmanager

import redis.asyncio as redis
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.guards.rate_limit import rate_limiter_guard
from app.settings import settings
from app.states.app import AppState, GlobalState
from app.ws import WebSocketManager


@asynccontextmanager
async def lifespan(app: FastAPI):
    redis_client = redis.from_url(
        settings.REDIS_ENDPOINT,
        encoding="utf-8",
        decode_responses=True,
    )

    # Initialise shared Redis client and ensure state doc exists
    GlobalState.init_redis(redis_client)
    await AppState.ensure_created()

    # Start WebSocket manager pub/sub listener
    ws_manager = WebSocketManager()
    await ws_manager.start(redis_client)
    app.state.ws_manager = ws_manager

    yield

    # Shutdown
    await ws_manager.stop()
    await redis_client.aclose()


app = FastAPI(
    root_path=settings.ROOT_PATH,
    openapi_url="/openapi.json",
    dependencies=[Depends(rate_limiter_guard)],
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

from app.routes.admin.config import router as admin_config_router

app.include_router(admin_config_router, prefix="/admin")

from app.routes.admin.user import router as admin_user_router

app.include_router(admin_user_router, prefix="/admin")

from app.routes.admin.files import router as admin_file_router

app.include_router(admin_file_router, prefix="/admin")

from app.routes.config import router as config_router

app.include_router(config_router)

from app.routes.login import router as login_router

app.include_router(login_router)

from app.routes.user import router as user_router

app.include_router(user_router)

from app.routes.upload import router as upload_router

app.include_router(upload_router)

from app.routes.download import router as download_router

app.include_router(download_router)

from app.routes.information import router as information_router

app.include_router(information_router)

from app.routes.onboarding import router as onboarding_router

app.include_router(onboarding_router)

from app.routes.speedtest import router as speedtest_router

app.include_router(speedtest_router)

from app.routes.token import router as token_router

app.include_router(token_router)

from app.routes.ws import router as ws_router

app.include_router(ws_router)
