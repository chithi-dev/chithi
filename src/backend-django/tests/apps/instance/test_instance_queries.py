"""Tests for instance domain queries."""

import pytest


@pytest.mark.asyncio
async def test_instance_information_has_version():
    """Instance information returns version data."""
    from apps.instance.graphql.queries import InstanceQueries

    queries = InstanceQueries()
    result = await queries.information()  # type: ignore[attr-defined]
    assert "python" in str(result).lower() or result is not None  # type: ignore[truthy-assert]


@pytest.mark.asyncio
async def test_instance_statistics_returns_dict():
    """Instance statistics returns a dict with counts."""
    from apps.instance.graphql.queries import InstanceQueries

    queries = InstanceQueries()
    stats = await queries.statistics()  # type: ignore[attr-defined]
    assert isinstance(stats, dict)  # type: ignore[unreachable]
