"""Instance configuration endpoint (django-ninja).

``GET /config/`` returns the public site settings the CLI needs to pick upload
defaults (expiry, download count, whether uploads are allowed). Mirrors the
GraphQL ``config`` query. The singleton read uses the native async
``Config.aload()``, so no threadpool hop is needed.
"""

from ninja import Router

from apps.api.schemas.config import ConfigResponse
from apps.config.models import Config

router = Router()


@router.get("/config/", response=ConfigResponse)
async def config(request) -> ConfigResponse:
    cfg = await Config.aload()
    return ConfigResponse(
        allow_uploads=cfg.allow_uploads,
        max_file_size_limit=cfg.max_file_size_limit,
        default_expiry=cfg.default_expiry,
        default_number_of_downloads=cfg.default_number_of_downloads,
        site_description=cfg.site_description or None,
    )
