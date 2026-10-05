from ninja import NinjaAPI

from apps.api.views.upload import router as upload_router

api = NinjaAPI(
    title="Chithi API",
    urls_namespace="api",
)

api.add_router("/upload", upload_router, tags=["upload"])
