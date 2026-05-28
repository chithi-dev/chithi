from __future__ import annotations

import strawberry


@strawberry.type
class LatencyResult:
    """Latency measurement result."""
    timestamp: float
    latency_ms: float | None = None  # round-trip time in milliseconds


@strawberry.type
class UploadSpeedResult:
    """Upload speed test result."""
    bytes_received: int
    timestamp: float


@strawberry.type
class DownloadResult:
    """Download speed test result (from presigned URL)."""
    download_url: str
