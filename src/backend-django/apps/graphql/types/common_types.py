import strawberry

from apps.graphql.types.scalars import BigInt


@strawberry.type
class TokenResponse:
    access: str
    refresh: str


@strawberry.type
class OnboardingType:
    is_configured: bool
    has_users: bool


@strawberry.type
class InstanceInfoType:
    backend_version: str
    python_version: str
    platform: str


@strawberry.type
class InstanceStatisticsType:
    total_files: int
    active_files: int
    expired_files: int
    total_storage_used: BigInt
    total_users: int


@strawberry.type
class OnboardingPOSTOut:
    access: str
    refresh: str
    onboarded: bool