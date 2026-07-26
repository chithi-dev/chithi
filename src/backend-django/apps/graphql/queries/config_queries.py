import strawberry

from apps.config.models import Config
from apps.graphql.types import ConfigType


@strawberry.type
class ConfigQueries:
    """Public configuration queries."""

    @strawberry.field
    def config(self) -> ConfigType:
        return Config.load()
