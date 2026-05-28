"""httpx-based GraphQL client for Django backend."""

from __future__ import annotations

import json
from pathlib import Path
from types import TracebackType
from typing import Any, Self
from urllib.parse import urljoin

import httpx


STREAM_CHUNK_SIZE = 8 * 1024 * 1024


class GraphQLClient:
    """Async client for the Django GraphQL backend."""

    def __init__(self, graphql_url: str) -> None:
        self._graphql_url = graphql_url.rstrip("/") + "/graphql"
        self._session = httpx.AsyncClient(timeout=httpx.Timeout(connect=30.0), follow_redirects=True)

    async def __aenter__(self) -> Self:
        return self

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc_value: BaseException | None,
        traceback: TracebackType | None,
    ) -> None:
        await self.close()

    async def close(self) -> None:
        await self._session.aclose()

    async def query(
        self,
        operation: str,
        variables: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Execute a GraphQL query/mutation and return parsed result."""
        payload: dict[str, Any] = {"query": operation}
        if variables is not None:
            payload["variables"] = variables

        resp = await self._session.post(
            self._graphql_url,
            json=payload,
            headers={"Content-Type": "application/json"},
        )
        resp.raise_for_status()
        data = resp.json()
        if errors := data.get("errors"):
            raise RuntimeError("; ".join(e["message"] for e in errors))
        return data["data"]  # type: ignore[return-value]

    async def upload_file(
        self,
        file_path: Path,
        filename: str | None = None,
        expire_after_n_download: int = 10,
        number_of_files: int = 1,
        expire_after: int | None = None,  # kept for backward compat with CLI
    ) -> dict[str, Any]:
        """Upload a file via GraphQL upload mutation (multipart form)."""
        display_filename = filename or file_path.name

        resp = await self._session.post(
            self._graphql_url,
            files={
                "file": (display_filename, file_path.read_bytes(), "application/octet-stream"),
            },
            data={
                "filename": display_filename,
                "expireAfterNDownload": str(expire_after_n_download),
                "numberOfFiles": str(number_of_files),
            },
        )
        resp.raise_for_status()
        result = resp.json()
        if errors := result.get("errors"):
            raise RuntimeError("; ".join(e["message"] for e in errors))
        return result

    async def login(self, username: str, password: str) -> dict[str, Any]:
        """Login and store JWT token."""
        mutation = (
            'mutation Login($username: String!, $password: String!) { '
            '  login(username: $username, password: $password) { accessToken } '
            '}'
        )
        result = await self.query(mutation, {"username": username, "password": password})
        token = result.get("login", {}).get("accessToken")
        if not token:
            raise RuntimeError("No access token in login response")
        return result

    async def download_stream_to_file(self, key: str, dest: Path) -> None:
        """Download a file via GraphQL downloadStream mutation (streaming binary)."""
        async with self._session.stream(
            "POST",
            self._graphql_url,
            json={"query": "{ downloadStream(key: \"%s\") { filename size } }" % key},
        ) as resp:
            content_type = resp.headers.get("Content-Type", "")
            if "text/html" in content_type and "application/octet-stream" not in content_type:
                raise ConnectionError(
                    f"Expected binary stream but got HTML. URL may be wrong.\nURL: {self._graphql_url}"
                )

            resp.raise_for_status()
            total = int(resp.headers.get("content-length", 0)) or None
            written = 0

            with open(dest, "wb") as f:
                async for chunk in resp.aiter_bytes(STREAM_CHUNK_SIZE):
                    f.write(chunk)
                    written += len(chunk)
                    if total and written >= total:
                        break

    @classmethod
    def resolve_graphql_url(cls, initial_url: str | None = None) -> str:
        """Resolve the GraphQL endpoint URL from input/env/prompts."""
        import os  # noqa: F401 -- used by UrlBuilder

        from cli.core.urls import UrlBuilder  # noqa: F401

        builder = UrlBuilder.resolve(initial_url)
        return urljoin(builder.backend_url, "graphql")
