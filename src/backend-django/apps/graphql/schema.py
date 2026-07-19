import strawberry
import strawberry_django
from django.contrib.auth import get_user_model
from strawberry.types import Info

from apps.config.models import Config
from apps.files.models import File

from .types import ConfigType, FileType, OnboardingType, TokenResponse, UserType


def get_jwt_tokens(user) -> tuple[str, str]:
    from rest_framework_simplejwt.tokens import RefreshToken

    refresh = RefreshToken.for_user(user)
    return str(refresh.access_token), str(refresh)


@strawberry.type
class Query:
    @strawberry_django.field
    def users(self) -> list[UserType]:
        User = get_user_model()
        return list(User.objects.all())

    @strawberry_django.field
    def files(self) -> list[FileType]:
        return list(File.objects.all())

    @strawberry.field
    def config(self) -> ConfigType:
        return Config.load()

    @strawberry.field
    def onboarding(self, info: Info) -> OnboardingType:
        User = get_user_model()
        return OnboardingType(
            is_configured=Config.objects.exists(),
            has_users=User.objects.exists(),
        )

    @strawberry.field
    def me(self, info: Info) -> UserType | None:
        user = info.context.request.user
        if not user.is_authenticated:
            return None
        return user


@strawberry.type
class Mutation:
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
            token_string = auth_header.split("Bearer ", 1)[1].strip()
            try:
                refresh = RefreshToken(token_string)
                refresh.blacklist()
            except Exception:
                pass
        return True

    @strawberry_django.mutation
    def update_config(
        self,
        info: Info,
        total_storage_limit: int | None = None,
        max_file_size_limit: int | None = None,
        default_expiry: int | None = None,
        default_number_of_downloads: int | None = None,
        site_description: str | None = None,
        download_configs: list[int] | None = None,
        time_configs: list[int] | None = None,
        allowed_file_types: list[str] | None = None,
        banned_file_types: list[str] | None = None,
        allow_uploads: bool | None = None,
    ) -> ConfigType:
        config = Config.load()
        if total_storage_limit is not None:
            config.total_storage_limit = total_storage_limit
        if max_file_size_limit is not None:
            config.max_file_size_limit = max_file_size_limit
        if default_expiry is not None:
            config.default_expiry = default_expiry
        if default_number_of_downloads is not None:
            config.default_number_of_downloads = default_number_of_downloads
        if site_description is not None:
            config.site_description = site_description
        if download_configs is not None:
            config.download_configs = download_configs
        if time_configs is not None:
            config.time_configs = time_configs
        if allowed_file_types is not None:
            config.allowed_file_types = allowed_file_types
        if banned_file_types is not None:
            config.banned_file_types = banned_file_types
        if allow_uploads is not None:
            config.allow_uploads = allow_uploads
        config.save()
        return config

    @strawberry_django.mutation
    def delete_file(self, info: Info, id: strawberry.ID) -> bool:
        File.objects.filter(id=id).delete()
        return True

    @strawberry_django.mutation
    def create_user(
        self,
        info: Info,
        username: str,
        password: str,
        email: str | None = None,
    ) -> UserType:
        User = get_user_model()
        user = User.objects.create_user(username=username, password=password, email=email)
        return user

    @strawberry_django.mutation
    def update_user(
        self,
        info: Info,
        id: strawberry.ID,
        username: str | None = None,
        email: str | None = None,
    ) -> UserType:
        User = get_user_model()
        user = User.objects.get(id=id)
        if username is not None:
            user.username = username
        if email is not None:
            user.email = email
        user.save()
        return user

    @strawberry_django.mutation
    def delete_user(self, info: Info, id: strawberry.ID) -> bool:
        User = get_user_model()
        User.objects.filter(id=id).delete()
        return True


schema = strawberry.Schema(query=Query, mutation=Mutation)
