"""Instance info and statistics."""

from __future__ import annotations

import datetime
import platform

import django


class InstanceService:
    """Server info and statistics."""

    async def get_instance_info(self) -> dict:
        from django.conf import settings as dj_settings  # noqa: F811

        app_version = getattr(dj_settings, "APP_VERSION", None)
        git_commit = getattr(dj_settings, "GIT_COMMIT", None)

        return {
            "python_version": platform.python_version(),
            "django_version": django.VERSION,
            "version": app_version or "",
            "commit": git_commit or "",
        }

    async def get_instance_statistics(self) -> dict:
        from apps.files.models import FileRecord
        from apps.reverse_rooms.models import Room
        from datetime import timedelta, timezone
        from django.db.models import Coalesce, F, Q, Sum

        now = datetime.datetime.now(timezone.utc)
        soon = now + timedelta(days=1)

        from apps.users.models import User  # noqa: F811
        users_count = await User.objects.acount()

        total_bytes_result = await FileRecord.objects.aggregate(
            total_bytes=Coalesce(Sum("size"), 0)
        )
        total_bytes = int(total_bytes_result["total_bytes"] or 0)

        total_files = await FileRecord.objects.acount()

        total_downloads_result = await FileRecord.objects.aggregate(
            td=Coalesce(Sum("download_count"), 0)
        )
        total_downloads = int(total_downloads_result["td"] or 0)

        active_urls = await FileRecord.objects.filter(
            Q(expires_at__gte=now) & Q(download_count__lt=F("expire_after_n_download"))
        ).acount()

        active_rooms = await Room.objects.filter(expires_at__gte=now).acount()

        links_with_download_caps = total_files

        expiring_soon = await FileRecord.objects.filter(
            Q(expires_at__gte=now) & Q(expires_at__lte=soon)
            & Q(download_count__lt=F("expire_after_n_download"))
        ).acount()

        latest = (
            await FileRecord.objects.filter(
                expires_at__gte=now, download_count__lt=F("expire_after_n_download")
            )
            .order_by("-expires_at")
            .values_list("expires_at", flat=True)
            .afirst()
        )

        latest_expiry = int(latest.timestamp()) if latest else None

        return {
            "total_bytes": total_bytes,
            "total_files": total_files,
            "total_downloads": total_downloads,
            "active_urls": active_urls,
            "active_rooms": active_rooms,
            "links_with_download_caps": links_with_download_caps,
            "expiring_soon": expiring_soon,
            "latest_expiry": latest_expiry,
        }


async def get_redis_version() -> str | None:
    from core.cache import redis_version as _redis_ver  # noqa: F401

    return await _redis_ver()


async def get_postgres_version() -> str | None:
    from django.conf import settings as dj_settings  # noqa: F811

    db_config = getattr(dj_settings, "DATABASES", {}).get("default", {})
    engine = db_config.get("ENGINE", "")
    if not engine or "postgresql" not in engine:
        return None

    try:
        from django.db import connection as _conn

        with _conn.cursor() as cur:
            cur.execute("SHOW server_version")
            row = cur.fetchone()
            return str(row[0]) if row else None
    except Exception:
        db_host = db_config.get("HOST", "localhost")
        db_port = db_config.get("PORT", "5432")
        db_name = db_config.get("NAME", "<unknown>")
        engine_short = engine.split(".")[-1] if "." in engine else engine
        return f"{engine_short}://{db_host}:{db_port}/{db_name}"
