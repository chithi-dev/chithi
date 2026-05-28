"""Tests for speedtest domain queries."""

import pytest


@pytest.mark.asyncio
async def test_latency_returns_timestamp():
    """Latency query returns server timestamp."""
    from apps.speedtest.graphql.queries import SpeedtestQueries

    queries = SpeedtestQueries()
    result = await queries.latency()  # type: ignore[attr-defined]
    assert result is not None  # type: ignore[truthy-assert]
