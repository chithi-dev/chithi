"""Onboarding queries for the GraphQL API."""

import strawberry
from django.contrib.auth import get_user_model

from apps.config.models import Config
from apps.graphql.types import OnboardingType


@strawberry.type
class OnboardingQueries:
    """Onboarding status queries."""

    @strawberry.field
    def onboarding(self) -> OnboardingType:
        User = get_user_model()

        try:
            Config.load()
            is_configured = True
        except Config.DoesNotExist:
            is_configured = False

        return OnboardingType(is_configured=is_configured, has_users=User.objects.exists())
