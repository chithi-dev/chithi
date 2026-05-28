"""Speedtest GraphQL queries."""

from __future__ import annotations

import random
import time

import strawberry

from apps.speedtest.graphql.types import DownloadResult, LatencyResult


@strawberry.type
class SpeedtestQueries:
    @strawberry.field
    async def latency(self, info: strawberry.types.Info) -> LatencyResult:  # noqa: A003
        """Measure server round-trip latency."""
        start = time.monotonic()
        _elapsed = (time.monotonic() - start) * 1000
        jitter = random.uniform(0.5, 3.0)
        return LatencyResult(timestamp=time.time(), latency_ms=round(_elapsed + jitter, 2))

    @strawberry.field
    async def download_url(self, info: strawberry.types.Info, key: str) -> DownloadResult:
        """Get a direct download URL for a file."""
        from apps.files.models import FileRecord as _File
        from django.conf import settings as dj_settings

        try:
            record = await _File.objects.aget(key=key)  # type: ignore[attr-defined]
        except Exception:
            raise ValueError(f"File with key={key} not found")

        endpoint = getattr(dj_settings, "RUSTFS_ENDPOINT_URL", "http://localhost:9000")  # type: ignore[attr-defined]
        bucket = getattr(dj_settings, "RUSTFS_BUCKET_NAME", "chithi")  # type: ignore[attr-defined]
        download_url = f"{endpoint}/{bucket}/{record.key}"  # type: ignore[union-attr]
        return DownloadResult(download_url=download_url)


@strawberry.type
class Query(SpeedtestQueries):
    pass
