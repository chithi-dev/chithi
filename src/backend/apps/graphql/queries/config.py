import strawberry
from asgiref.sync import sync_to_async

from apps.config.models import Config
from apps.graphql.types import ConfigType


@strawberry.type
class ConfigQuery:
    @strawberry.field
    async def config(self) -> ConfigType:
        return await sync_to_async(Config.load)()
