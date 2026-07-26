import strawberry
from django.core.files.uploadedfile import UploadedFile
from strawberry.file_uploads import Upload, UploadDefinition
from strawberry.types import Info

from apps.config.models import Config
from apps.files.models import File
from apps.files.services import delete_file_from_s3, upload_file_data
from apps.graphql.types import (
    ConfigType,
    FileType,
    InstanceInfoType,
    InstanceStatisticsType,
    OnboardingType,
    PaginatedFiles,
    TokenResponse,
    UserType,
    OnboardingPOSTOut,
)

import platform
import sys
from uuid import uuid4
from django.contrib.auth import get_user_model
from django.core.paginator import Paginator
from django.utils import timezone


@strawberry.type
class Query:
    # ── Config ──
    @strawberry.field
    def config(self) -> ConfigType:
        return Config.load()

    # ── Files ──
    @strawberry.field
    def files(self) -> list[FileType]:
        return list(File.objects.all())

    @strawberry.field
    def file_info(self, key: str) -> FileType | None:
        try:
            return File.objects.get(key=key)
        except File.DoesNotExist:
            return None

    # ── Admin Files (paginated) ──
    @strawberry.field
    def admin_files(
        self,
        page: int = 1,
        size: int = 10,
        search: str | None = None,
    ) -> PaginatedFiles:
        qs = File.objects.all().order_by("-created_at")
        if search:
            qs = qs.filter(filename__icontains=search)
        paginator = Paginator(qs, size)
        page_obj = paginator.get_page(page)
        return PaginatedFiles(
            items=list(page_obj),
            total=paginator.count,
            page=page,
            size=size,
            pages=paginator.num_pages,
        )

    # ── Instance ──
    @strawberry.field
    def instance_information(self) -> InstanceInfoType:
        return InstanceInfoType(
            backend_version="0.1.0",
            python_version=sys.version,
            platform=platform.system(),
        )

    @strawberry.field
    def instance_statistics(self) -> InstanceStatisticsType:
        from django.db.models import Sum

        now = timezone.now()
        User = get_user_model()
        return InstanceStatisticsType(
            total_files=File.objects.count(),
            active_files=File.objects.filter(expires_at__gt=now).count(),
            expired_files=File.objects.filter(expires_at__lte=now).count(),
            total_storage_used=File.objects.aggregate(Sum("size"))["sum"] or 0,
            total_users=User.objects.count(),
        )

    # ── Onboarding ──
    @strawberry.field
    def onboarding(self) -> OnboardingType:
        User = get_user_model()
        try:
            Config.load()
            is_configured = True
        except Config.DoesNotExist:
            is_configured = False
        return OnboardingType(is_configured=is_configured, has_users=User.objects.exists())

    # ── Users ──
    @strawberry.field
    def users(self) -> list[UserType]:
        User = get_user_model()
        return list(User.objects.all())

    @strawberry.field
    def me(self, info: Info) -> UserType | None:
        user = info.context.request.user
        return user if user and user.is_authenticated else None


@strawberry.type
class Mutation:
    # ── Auth ──
    @strawberry.mutation
    def login(self, username: str, password: str) -> TokenResponse:
        from django.contrib.auth import authenticate
        from rest_framework_simplejwt.tokens import RefreshToken

        user = authenticate(username=username, password=password)
        if not user:
            raise ValueError("Invalid credentials")
        refresh = RefreshToken.for_user(user)
        return TokenResponse(
            access=str(refresh.access_token),
            refresh=str(refresh),
        )

    @strawberry.mutation
    def logout(self, info: Info) -> bool:
        from rest_framework_simplejwt.tokens import RefreshToken
        from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken

        refresh_token = info.context.COOKIES.get("refresh")
        if refresh_token:
            try:
                token = RefreshToken(refresh_token)
                BlacklistedToken.objects.create(token=token)
                return True
            except Exception:
                pass
        return False

    @strawberry.mutation
    def complete_onboarding(
        self,
        username: str,
        email: str,
        password: str,
        site_description: str,
    ) -> OnboardingPOSTOut:
        from django.contrib.auth import get_user_model
        from rest_framework_simplejwt.tokens import RefreshToken

        User = get_user_model()
        user = User.objects.create_superuser(username=username, email=email, password=password)
        Config.objects.update_or_create(
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
        refresh = RefreshToken.for_user(user)
        return OnboardingPOSTOut(
            access=str(refresh.access_token),
            refresh=str(refresh),
            onboarded=True,
        )

    # ── Config ──
    @strawberry.mutation
    def update_config(
        self,
        total_storage_limit: int | None = None,
        max_file_size_limit: int | None = None,
        default_expiry: int | None = None,
        default_number_of_downloads: int | None = None,
        site_description: str | None = None,
        allow_uploads: bool | None = None,
    ) -> ConfigType:
        config, _ = Config.objects.get_or_create(pk=1)
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
        config.save()
        return config

    # ── Files ──
    @strawberry.mutation
    def upload_file(
        self,
        info: Info,
        file: Upload,
        filename: str,
        expires_at: int,
        expire_after_n_download: int,
        number_of_files: int | None = None,
    ) -> FileType:
        file_data = file.read()
        key = str(uuid4())
        upload_file_data(key=key, data=file_data)
        return File.objects.create(
            key=key,
            filename=filename,
            size=len(file_data),
            expires_at=timezone.now() + timezone.timedelta(seconds=expires_at),
            expire_after_n_download=expire_after_n_download,
            number_of_files=number_of_files,
        )

    @strawberry.mutation
    def delete_file(self, file_id: strawberry.ID) -> bool:
        try:
            file_obj = File.objects.get(id=file_id)
            delete_file_from_s3(file_obj.key)
            file_obj.delete()
            return True
        except File.DoesNotExist:
            return False

    # ── Users ──
    @strawberry.mutation
    def create_user(
        self,
        username: str,
        password: str,
        email: str | None = None,
    ) -> UserType:
        User = get_user_model()
        return User.objects.create_user(
            username=username,
            email=email or "",
            password=password,
        )

    @strawberry.mutation
    def update_user(
        self,
        user_id: strawberry.ID,
        username: str | None = None,
        email: str | None = None,
        is_staff: bool | None = None,
        is_active: bool | None = None,
    ) -> UserType:
        User = get_user_model()
        user = User.objects.get(id=user_id)
        if username is not None:
            user.username = username
        if email is not None:
            user.email = email
        if is_staff is not None:
            user.is_staff = is_staff
        if is_active is not None:
            user.is_active = is_active
        user.save()
        return user

    @strawberry.mutation
    def delete_user(self, user_id: strawberry.ID) -> bool:
        User = get_user_model()
        try:
            User.objects.get(id=user_id).delete()
            return True
        except User.DoesNotExist:
            return False


schema = strawberry.Schema(
    query=Query,
    mutation=Mutation,
    scalar_overrides={UploadedFile: UploadDefinition},
)
