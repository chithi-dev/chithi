import strawberry

from apps.config.models import Config
from apps.graphql.types import ConfigType


@strawberry.type
class ConfigQueries:
    @strawberry.field
    def config(self) -> ConfigType:
        return Config.load()
