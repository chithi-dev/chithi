"""Async REST API client for the Chithi backend.

Upload flow:
  1. POST /api/upload/register/  -> get file key
  2. POST /api/upload/chunk/     (per 50 MB chunk, multipart)
  3. POST /api/upload/complete/

Download flow:
  1. GET /api/files/{slug}/info/        -> get chunk_count
  2. GET /api/files/{slug}/chunk/{i}/   -> presigned S3 URL (or local path)
  3. Fetch each chunk from that URL
  4. Reassemble into a single byte buffer
"""

from types import TracebackType
from typing import Any, Self
from urllib.parse import urlparse

import httpx2

from app.builder.urls import UrlBuilder

CHUNK_SIZE = 50 * 1024 * 1024

DEFAULT_TIMEOUT = httpx2.Timeout(connect=30.0, read=None, write=None, pool=None)


class Client:
    """Async REST + object-storage client for the Chithi backend."""

    def __init__(self, urls: UrlBuilder) -> None:
        self.urls = urls
        self._session = httpx2.AsyncClient(
            headers={
                "Origin": self.urls.frontend_url.rstrip("/"),
                "Referer": self.urls.frontend_url,
            },
            timeout=DEFAULT_TIMEOUT,
            follow_redirects=True,
            http2=True,
        )

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

    @classmethod
    def resolve(cls, initial_url: str | None = None) -> Self:
        return cls(UrlBuilder.resolve(initial_url))

    @property
    def _api_base(self) -> str:
        return self.urls.backend_url.rstrip("/")

    @property
    def _api_register_url(self) -> str:
        return self._api_base + "/upload/register/"

    @property
    def _api_chunk_url(self) -> str:
        return self._api_base + "/upload/chunk/"

    @property
    def _api_complete_url(self) -> str:
        return self._api_base + "/upload/complete/"

    @property
    def _api_config_url(self) -> str:
        return self._api_base + "/config/"

    def _api_file_info_url(self, slug: str) -> str:
        return self._api_base + f"/files/{slug}/info/"

    def _api_file_chunk_url(self, slug: str, index: int) -> str:
        return self._api_base + f"/files/{slug}/chunk/{index}/"

    async def _api_request(self, method: str, url: str, **kwargs: Any) -> dict[str, Any]:
        """Send a REST request and return the parsed JSON body."""
        response = await self._session.request(method, url, **kwargs)
        if response.status_code >= 400:
            try:
                body = response.json()
            except Exception:
                body = {}
            detail = body.get("detail", response.text)
            raise ConnectionError(f"{method} {url} -> {response.status_code}: {detail}")
        return response.json()

    async def _api_post(self, url: str, **kwargs: Any) -> dict[str, Any]:
        return await self._api_request("POST", url, **kwargs)

    async def _api_get(self, url: str, **kwargs: Any) -> dict[str, Any]:
        return await self._api_request("GET", url, **kwargs)

    async def get_config(self) -> dict[str, Any]:
        """Fetch the instance config and normalise to the CLI's keys."""
        config = await self._api_get(self._api_config_url)
        return {
            "default_expiry": config.get("default_expiry", 86400),
            "default_number_of_downloads": config.get("default_number_of_downloads", 1),
            "allow_uploads": config.get("allow_uploads", True),
        }

    async def upload_file(
        self,
        encrypted_data: bytes,
        filename: str,
        expire_after_n_download: int = 1,
        expire_after: int = 86400,
        number_of_files: int | None = None,
    ) -> dict[str, Any]:
        """Upload encrypted bytes in 50 MB chunks via the REST chunked flow.

        Returns a dict with 'id' and 'key' (the file slug).
        """
        total_size = len(encrypted_data)
        chunk_count = max(1, -(-total_size // CHUNK_SIZE))

        reg = await self._api_post(
            self._api_register_url,
            json={
                "filename": filename,
                "total_size": total_size,
                "chunk_count": chunk_count,
                "expires_at": expire_after,
                "expire_after_n_download": expire_after_n_download,
                "number_of_files": number_of_files,
            },
        )
        file_key: str = reg["key"]
        file_id: str = reg["id"]

        for i in range(chunk_count):
            start = i * CHUNK_SIZE
            end = min(start + CHUNK_SIZE, total_size)
            await self._api_post(
                self._api_chunk_url,
                data={"file_key": file_key, "chunk_index": i},
                files={"chunk": (f"chunk-{i}", encrypted_data[start:end], "application/octet-stream")},
            )

        await self._api_post(self._api_complete_url, data={"file_key": file_key})

        return {"id": file_id, "key": file_key}

    async def download_file(self, slug: str) -> bytes:
        """Download a file chunk-by-chunk and return the reassembled encrypted bytes."""
        info = await self._api_get(self._api_file_info_url(slug))
        if info.get("is_expired"):
            raise ConnectionError("File has expired")

        chunk_count: int = info["chunk_count"]
        origin = f"{urlparse(self.urls.backend_url).scheme}://{urlparse(self.urls.backend_url).netloc}"

        chunks: list[bytes] = []
        for i in range(chunk_count):
            url: str = (await self._api_get(self._api_file_chunk_url(slug, i)))["url"]
            if not url:
                raise ConnectionError(f"No URL returned for chunk {i}")

            fetch_url = url if url.startswith(("http://", "https://")) else origin + url

            async with self._session.stream("GET", fetch_url) as resp:
                if resp.status_code >= 400:
                    raise ConnectionError(f"Chunk {i} fetch failed: {resp.status_code}")
                chunks.append(b"".join([c async for c in resp.aiter_bytes()]))

        return b"".join(chunks)
