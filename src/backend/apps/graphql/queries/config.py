import strawberry

from apps.config.models import Config
from apps.graphql.types import ConfigType


@strawberry.type
class ConfigQuery:
    @strawberry.field
    async def config(self) -> ConfigType:
        return await Config.aload()
