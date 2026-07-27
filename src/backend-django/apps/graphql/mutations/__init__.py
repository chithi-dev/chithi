import strawberry
from asgiref.sync import sync_to_async
from strawberry.file_uploads import Upload
from strawberry.types import Info
from uuid import uuid4
from django.contrib.auth import authenticate, get_user_model
from django.utils import timezone
from django.urls import reverse

from apps.config.models import Config
from apps.files.models import File
from apps.files.services import (
    delete_file_from_s3,
    upload_file_data,
)
from apps.graphql.auth import get_jwt_tokens
from apps.graphql.types import (
    ConfigType,
    FileType,
    OnboardingPOSTOut,
    TokenResponse,
    UserType,
)


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


@strawberry.type
class ConfigMutation:
    @strawberry.mutation
    async def update_config(
        self,
        total_storage_limit: int | None = None,
        max_file_size_limit: int | None = None,
        default_expiry: int | None = None,
        default_number_of_downloads: int | None = None,
        site_description: str | None = None,
        allow_uploads: bool | None = None,
    ) -> ConfigType:
        config = await sync_to_async(Config.objects.get_or_create)(pk=1)[0]
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
        if allow_uploads is not None:
            config.allow_uploads = allow_uploads
        await sync_to_async(config.save)()
        return config


@strawberry.type
class FileMutation:
    @strawberry.mutation
    async def upload_file(
        self,
        filename: str,
        file: Upload,
        expires_at: int,
        expire_after_n_download: int,
        number_of_files: int | None = None,
    ) -> FileType:
        file_data = await file.read()
        key = str(uuid4())
        await upload_file_data(key=key, data=file_data)
        return await sync_to_async(File.objects.create)(
            key=key,
            filename=filename,
            size=len(file_data),
            expires_at=timezone.now() + timezone.timedelta(seconds=expires_at),
            expire_after_n_download=expire_after_n_download,
            number_of_files=number_of_files,
        )

    @strawberry.mutation
    async def delete_file(self, file_id: strawberry.ID) -> bool:
        try:
            file_obj = await sync_to_async(File.objects.get)(id=file_id)
            await delete_file_from_s3(file_obj.key)
            await sync_to_async(file_obj.delete)()
            return True
        except File.DoesNotExist:
            return False

    @strawberry.mutation
    async def download_file_stream(self, file_key: str) -> str:
        """Return a presigned URL for direct binary download from S3."""
        return get_presigned_download_url(file_key)


@strawberry.type
class UserMutation:
    @strawberry.mutation
    async def create_user(
        self,
        username: str,
        password: str,
        email: str | None = None,
    ) -> UserType:
        User = get_user_model()
        return await sync_to_async(User.objects.create_user)(
            username=username,
            email=email or "",
            password=password,
        )

    @strawberry.mutation
    async def update_user(
        self,
        user_id: strawberry.ID,
        username: str | None = None,
        email: str | None = None,
        is_staff: bool | None = None,
        is_active: bool | None = None,
    ) -> UserType:
        User = get_user_model()
        user = await sync_to_async(User.objects.get)(id=user_id)
        if username is not None:
            user.username = username
        if email is not None:
            user.email = email
        if is_staff is not None:
            user.is_staff = is_staff
        if is_active is not None:
            user.is_active = is_active
        await sync_to_async(user.save)()
        return user

    @strawberry.mutation
    async def delete_user(self, user_id: strawberry.ID) -> bool:
        User = get_user_model()
        try:
            user = await sync_to_async(User.objects.get)(id=user_id)
            await sync_to_async(user.delete)()
            return True
        except User.DoesNotExist:
            return False


__all__ = ["AuthMutation", "ConfigMutation", "FileMutation", "UserMutation"]
