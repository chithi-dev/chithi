import math
import platform
import sys

import strawberry
import strawberry_django
from django.contrib.auth import get_user_model
from django.db import models
from strawberry.types import Info

from apps.config.models import Config
from apps.files.models import File
from apps.files.services import delete_file_from_s3

from .types import (
    ConfigType,
    FileType,
    InstanceInfoType,
    InstanceStatisticsType,
    OnboardingPOSTOut,
    OnboardingType,
    PaginatedFiles,
    TokenResponse,
    UserType,
)


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
    def file_info(self, slug: str) -> FileType | None:
        """Look up a single file by its S3 key (slug)."""
        return File.objects.filter(key=slug).first()

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

    @strawberry.field
    def instance_information(self) -> InstanceInfoType:
        return InstanceInfoType(
            backend_version="1.0.0",
            python_version=sys.version,
            platform=platform.platform(),
        )

    @strawberry.field
    def instance_statistics(self) -> InstanceStatisticsType:
        User = get_user_model()
        from django.utils import timezone

        now = timezone.now()
        total = File.objects.count()
        expired = File.objects.filter(expires_at__lt=now).count()
        active = total - expired
        total_storage = File.objects.aggregate(
            total=models.Sum("size")
        )["total"] or 0
        total_users = User.objects.count()

        return InstanceStatisticsType(
            total_files=total,
            active_files=active,
            expired_files=expired,
            total_storage_used=total_storage,
            total_users=total_users,
        )

    @strawberry.field
    def admin_files(
        self,
        info: Info,
        page: int = 1,
        size: int = 10,
        search: str | None = None,
    ) -> PaginatedFiles:
        """Paginated file list for admin with optional search."""
        user = info.context.request.user
        if not user.is_authenticated:
            raise PermissionError("Authentication required")

        queryset = File.objects.all()

        if search:
            queryset = queryset.filter(filename__icontains=search)

        total = queryset.count()
        pages = max(1, math.ceil(total / size))
        start = (page - 1) * size
        items = list(queryset.order_by("-created_at")[start:start + size])

        return PaginatedFiles(
            items=items,
            total=total,
            page=page,
            size=size,
            pages=pages,
        )


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
            token_string = info.context.request.META.get("HTTP_AUTHORIZATION", "").split("Bearer ", 1)[1].strip()
            try:
                refresh = RefreshToken(token_string)
                refresh.blacklist()
            except Exception:
                pass
        return True

    @strawberry.mutation
    def upload_file(
        self,
        info: Info,
        filename: str,
        expire_after: int,
        expire_after_n_download: int,
        number_of_files: int | None = None,
    ) -> FileType:
        """Create a File record for an upload. Actual data upload is handled via presigned URLs or separate streaming."""
        user = info.context.request.user
        if not user.is_authenticated:
            raise PermissionError("Authentication required")

        config = Config.load()

        if not config.allow_uploads:
            raise ValueError("Uploads are currently disabled")

        if config.time_configs and expire_after not in config.time_configs:
            raise ValueError(f"Invalid expiry. Choose from: {config.time_configs}")

        if config.download_configs and expire_after_n_download not in config.download_configs:
            raise ValueError(f"Invalid download count. Choose from: {config.download_configs}")

        from django.utils import timezone
        import uuid_utils.compat as uuid

        key = str(uuid.uuid7())
        now = timezone.now()

        file_obj = File.objects.create(
            key=key,
            filename=filename,
            size=0,
            number_of_files=number_of_files,
            expires_at=now + timezone.timedelta(seconds=expire_after),
            expire_after_n_download=expire_after_n_download,
            download_count=0,
        )
        return file_obj

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
        file_obj = File.objects.filter(id=id).first()
        if file_obj:
            delete_file_from_s3(file_obj.key)
            file_obj.delete()
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
