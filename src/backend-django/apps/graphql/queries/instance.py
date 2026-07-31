import platform
import sys
import strawberry

from apps.graphql.types import InstanceInfoType


@strawberry.type
class InstanceQuery:
    @strawberry.field
    async def instance_information(self) -> InstanceInfoType:
        return InstanceInfoType(
            backend_version="0.1.0",
            python_version=sys.version,
            platform=platform.system(),
        )
