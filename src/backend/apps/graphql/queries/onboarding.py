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
        # aget (not aget_or_create) so an absent row still raises DoesNotExist,
        # which is what tells us the site is unconfigured.
        try:
            await Config.objects.aget(pk=1)
            is_configured = True
        except Config.DoesNotExist:
            is_configured = False
        return OnboardingType(
            is_configured=is_configured,
            has_users=await User.objects.aexists(),
        )
