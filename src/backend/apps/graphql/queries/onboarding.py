import strawberry
from asgiref.sync import sync_to_async
from django.contrib.auth import get_user_model

from apps.config.models import Config
from apps.graphql.types import OnboardingType


@strawberry.type
class OnboardingQuery:
    @strawberry.field
    async def onboarding(self) -> OnboardingType:
        User = get_user_model()
        try:
            await sync_to_async(Config.load)()
            is_configured = True
        except Config.DoesNotExist:
            is_configured = False
        return OnboardingType(
            is_configured=is_configured,
            has_users=await sync_to_async(User.objects.exists)(),
        )
