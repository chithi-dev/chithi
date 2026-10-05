import strawberry
from asgiref.sync import sync_to_async
from django.contrib.auth import authenticate, get_user_model

from apps.config.models import Config
from apps.graphql.auth import get_jwt_tokens
from apps.graphql.types import OnboardingPOSTOut, TokenResponse


@strawberry.type
class AuthMutation:
    @strawberry.mutation
    async def login(self, username: str, password: str) -> TokenResponse:
        user = await sync_to_async(authenticate)(username=username, password=password)
        if not user:
            raise ValueError("Invalid credentials")
        access, refresh = get_jwt_tokens(user)
        return TokenResponse(access=access, refresh=refresh)

    @strawberry.mutation
    async def complete_onboarding(
        self,
        username: str,
        email: str,
        password: str,
        site_description: str,
    ) -> OnboardingPOSTOut:
        User = get_user_model()
        user = await sync_to_async(User.objects.create_superuser)(
            username=username,
            email=email,
            password=password,
        )
        await sync_to_async(Config.objects.update_or_create)(
            pk=1,
            defaults={
                "site_description": site_description,
                "total_storage_limit": 10737418240,
                "max_file_size_limit": 1073741824,
                "default_expiry": 86400,
                "default_number_of_downloads": 10,
                "allow_uploads": True,
            },
        )
        access, refresh = get_jwt_tokens(user)
        return OnboardingPOSTOut(
            access=access,
            refresh=refresh,
            onboarded=True,
        )

    @strawberry.mutation
    def logout(self) -> bool:
        # Client-side token cleanup. Server-side JWT is stateless.
        return True
