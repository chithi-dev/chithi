from ninja import NinjaAPI

from apps.api.views.config import router as config_router
from apps.api.views.eviction import router as eviction_router
from apps.api.views.files import router as files_router
from apps.api.views.speedtest import router as speedtest_router
from apps.api.views.upload import router as upload_router

api = NinjaAPI(
    title="Chithi API",
    urls_namespace="api",
)

api.add_router("/upload", upload_router, tags=["upload"])
api.add_router("", config_router, tags=["config"])
api.add_router("", files_router, tags=["files"])
api.add_router("", speedtest_router, tags=["speedtest"])
api.add_router("", eviction_router, tags=["admin"])
