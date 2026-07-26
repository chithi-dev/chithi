import strawberry
from django.contrib.auth import get_user_model
from strawberry.types import Info

from apps.config.models import Config
from apps.graphql.auth import get_jwt_tokens
from apps.graphql.types import OnboardingPOSTOut, TokenResponse


@strawberry.type
class AuthMutations:
    """Authentication-related mutations."""

    @strawberry.mutation
    def login(self, username: str, password: str) -> TokenResponse:
        User = get_user_model()
        user = User.objects.filter(username=username).first()
        if not user or not user.check_password(password):
            raise ValueError("Invalid username or password")
        access, refresh = get_jwt_tokens(user)
        return TokenResponse(access=access, refresh=refresh)

    @strawberry.mutation
    def logout(self, info: Info) -> bool:
        """Client-side token discard. Stateless JWT — no server blacklist."""
        return True

    @strawberry.mutation
    def complete_onboarding(
        self,
        username: str,
        email: str,
        password: str,
        site_description: str,
    ) -> OnboardingPOSTOut:
        """Create the initial superuser, default config, and return JWT tokens."""
        User = get_user_model()

        user = User.objects.create_superuser(
            username=username,
            email=email,
            password=password,
        )

        Config.objects.update_or_create(
            defaults={"site_description": site_description},
        )

        access, refresh = get_jwt_tokens(user)

        return OnboardingPOSTOut(
            access=access,
            refresh=refresh,
            onboarded=True,
        )
