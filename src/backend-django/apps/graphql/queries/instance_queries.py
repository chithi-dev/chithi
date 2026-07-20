"""Instance information queries for the GraphQL API."""

import platform
import sys

import strawberry
from django.contrib.auth import get_user_model
from django.db.models import Sum
from django.utils import timezone

from apps.files.models import File
from apps.graphql.types import InstanceInfoType, InstanceStatisticsType


@strawberry.type
class InstanceQueries:
    """Instance metadata and statistics queries."""

    @strawberry.field
    def instance_information(self) -> InstanceInfoType:
        return InstanceInfoType(
            backend_version="0.1.0",
            python_version=sys.version,
            platform=platform.system(),
        )

    @strawberry.field
    def instance_statistics(self) -> InstanceStatisticsType:
        now = timezone.now()
        User = get_user_model()

        return InstanceStatisticsType(
            total_files=File.objects.count(),
            active_files=File.objects.filter(expires_at__gt=now).count(),
            expired_files=File.objects.filter(expires_at__lte=now).count(),
            total_storage_used=File.objects.aggregate(Sum("size"))["sum"] or 0,
            total_users=User.objects.count(),
        )
