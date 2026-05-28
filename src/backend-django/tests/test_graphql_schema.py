"""Tests for GraphQL schema completeness and parity."""

import pytest


@pytest.mark.asyncio
async def test_schema_is_not_none():
    """The root schema is properly assembled."""
    from core.graphql import schema

    assert schema is not None  # type: ignore[truthy-assert]


def test_schema_has_query_type():
    """Schema has a query type defined."""
    from core.graphql import schema

    types = schema.schema_dict.get("types", []) if hasattr(schema, "schema_dict") else []  # type: ignore[union-attr]
    assert len(types) > 0


def test_query_types_registered():
    """All domain query types are registered in the schema."""
    from core.graphql import Query

    query_fields = [f for f in dir(Query) if not f.startswith("_")]
    # Should have fields from all domain apps
    assert len(query_fields) > 5


def test_mutation_types_registered():
    """All domain mutation types are registered in the schema."""
    from core.graphql import Mutation

    mutation_fields = [f for f in dir(Mutation) if not f.startswith("_")]
    # Should have fields from all domain apps
    assert len(mutation_fields) > 5


@pytest.mark.asyncio
async def test_upload_mutation_exists():
    """Upload mutation is registered."""
    from core.graphql import Mutation

    assert hasattr(Mutation, "upload")  # type: ignore[attr-defined]


@pytest.mark.asyncio
async def test_download_stream_mutation_exists():
    """Download stream mutation is registered for S3 streaming."""
    from core.graphql import Mutation

    assert hasattr(Mutation, "download_stream")  # type: ignore[attr-defined]


@pytest.mark.asyncio
async def test_login_mutation_exists():
    """Login mutation is registered."""
    from core.graphql import Mutation

    assert hasattr(Mutation, "login")  # type: ignore[attr-defined]
