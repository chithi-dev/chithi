"""Instance configuration endpoint (django-ninja).

``GET /config/`` returns the public site settings the CLI needs to pick upload
defaults (expiry, download count, whether uploads are allowed). Mirrors the
GraphQL ``config`` query. The singleton read is sync, so it is wrapped in
``sync_to_async``.
"""

from asgiref.sync import sync_to_async
from ninja import Router

from apps.api.schemas.config import ConfigResponse
from apps.config.models import Config

router = Router()


def _config_response() -> ConfigResponse:
    config = Config.load()
    return ConfigResponse(
        allow_uploads=config.allow_uploads,
        max_file_size_limit=config.max_file_size_limit,
        default_expiry=config.default_expiry,
        default_number_of_downloads=config.default_number_of_downloads,
        site_description=config.site_description or None,
    )


@router.get("/config/", response=ConfigResponse)
async def config(request) -> ConfigResponse:
    return await sync_to_async(_config_response)()
