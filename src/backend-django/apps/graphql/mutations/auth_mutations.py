import strawberry
from django.contrib.auth import get_user_model
from strawberry.types import Info

from apps.config.models import Config
from apps.graphql.types import OnboardingPOSTOut, TokenResponse


def get_jwt_tokens(user) -> tuple[str, str]:
    from rest_framework_simplejwt.tokens import RefreshToken

    refresh = RefreshToken.for_user(user)
    return str(refresh.access_token), str(refresh)


@strawberry.type
class AuthMutations:
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
        from rest_framework_simplejwt.tokens import RefreshToken

        auth_header = info.context.request.META.get("HTTP_AUTHORIZATION", "")
        if auth_header.startswith("Bearer "):
            token_string = (
                info.context.request.META.get("HTTP_AUTHORIZATION", "")
                .split("Bearer ", 1)[1]
                .strip()
            )
            try:
                refresh = RefreshToken(token_string)
                refresh.blacklist()
            except Exception:
                pass
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
