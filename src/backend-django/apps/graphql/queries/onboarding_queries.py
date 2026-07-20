import strawberry
from django.contrib.auth import get_user_model
from strawberry.types import Info

from apps.config.models import Config
from apps.graphql.types import OnboardingType


@strawberry.type
class OnboardingQueries:
    @strawberry.field
    def onboarding(self, info: Info) -> OnboardingType:
        User = get_user_model()
        return OnboardingType(
            is_configured=Config.objects.exists(),
            has_users=User.objects.exists(),
        )
