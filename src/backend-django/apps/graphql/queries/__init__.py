import strawberry

from .config import ConfigQuery
from .file import FileQuery
from .instance import InstanceQuery
from .onboarding import OnboardingQuery
from .user import UserQuery


@strawberry.type
class Query(
    ConfigQuery,
    FileQuery,
    InstanceQuery,
    OnboardingQuery,
    UserQuery,
):
    pass


__all__ = ["Query"]
