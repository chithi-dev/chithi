"""Speedtest GraphQL mutations."""

from __future__ import annotations

import time

import strawberry

from apps.speedtest.graphql.types import UploadSpeedResult


@strawberry.type
class SpeedtestMutations:
    @strawberry.mutation
    async def upload_result(
        self, info: strawberry.types.Info, bytes_received: int, timestamp: float
    ) -> UploadSpeedResult:  # noqa: A002 - intentional shadowing
        """Record an upload speed test result."""
        return UploadSpeedResult(bytes_received=bytes_received, timestamp=time.time())


@strawberry.type
class Mutation(SpeedtestMutations):
    pass
