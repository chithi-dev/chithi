import strawberry
from django.contrib.auth import get_user_model

from apps.graphql.types import OnboardingType


@strawberry.type
class OnboardingQuery:
    @strawberry.field
    async def onboarding(self) -> OnboardingType:
        # ``Config`` is a self-recreating singleton: any ``Config.aload()`` /
        # ``get_or_create`` call (config query, upload registration, etc.) will
        # create the row if absent. So "does the Config row exist" is NOT a
        # reliable "onboarded" signal — it flips true the moment any endpoint
        # touches Config, even with no admin account yet.
        #
        # The reliable marker is "an admin user exists": onboarding's whole job
        # is to create the first superuser, and nothing else creates one.
        User = get_user_model()
        has_users = await User.objects.aexists()
        return OnboardingType(
            is_configured=has_users,
            has_users=has_users,
        )
