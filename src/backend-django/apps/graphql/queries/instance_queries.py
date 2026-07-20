import platform
import sys

import strawberry
from django.contrib.auth import get_user_model
from django.db import models

from apps.files.models import File
from apps.graphql.types import InstanceInfoType, InstanceStatisticsType


@strawberry.type
class InstanceQueries:
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
        total_storage = File.objects.aggregate(total=models.Sum("size"))["total"] or 0
        total_users = User.objects.count()

        return InstanceStatisticsType(
            total_files=total,
            active_files=active,
            expired_files=expired,
            total_storage_used=total_storage,
            total_users=total_users,
        )
