"""Async GraphQL API client for the Chithi backend.

Upload flow:
  1. registerFile  → get file key + chunk count
  2. uploadFileChunk (per 50 MB chunk, multipart GraphQL)
  3. completeUpload

Download flow:
  1. fileInfo      → get chunkCount
  2. chunkUrl (per chunk) → presigned S3 URL
  3. Fetch each chunk directly from S3
  4. Reassemble into a single byte buffer
"""

from __future__ import annotations

import io
from pathlib import Path
from types import TracebackType
from typing import Any, Self

import httpx2
from tqdm import tqdm

from app.builder.urls import UrlBuilder
from app.settings import settings

# Must match the backend's CHUNK_SIZE_BYTES
CHUNK_SIZE = 50 * 1024 * 1024

DEFAULT_TIMEOUT = httpx2.Timeout(connect=30.0, read=None, write=None, pool=None)

# ── GraphQL documents ───────────────────────────────────────────────────────

_REGISTER_FILE = """
mutation RegisterFile(
  $filename: String!
  $totalSize: Int!
  $chunkCount: Int!
  $expiresAt: Int!
  $expireAfterNDownload: Int!
  $numberOfFiles: Int
) {
  registerFile(
    filename: $filename
    totalSize: $totalSize
    chunkCount: $chunkCount
    expiresAt: $expiresAt
    expireAfterNDownload: $expireAfterNDownload
    numberOfFiles: $numberOfFiles
  ) { id key filename size chunkCount }
}
"""

_UPLOAD_FILE_CHUNK = """
mutation UploadFileChunk($fileKey: String!, $chunkIndex: Int!, $chunk: Upload!, $isLast: Boolean!) {
  uploadFileChunk(fileKey: $fileKey, chunkIndex: $chunkIndex, chunk: $chunk, isLast: $isLast)
}
"""

_COMPLETE_UPLOAD = """
mutation CompleteUpload($fileId: ID!) {
  completeUpload(fileId: $fileId)
}
"""

_FILE_INFO = """
query FileInfo($slug: String!) {
  fileInfo(key: $slug) {
    id key filename size chunkCount numberOfFiles
    downloadCount createdAt expiresAt expireAfterNDownload isExpired
  }
}
"""

_CHUNK_URL = """
mutation ChunkUrl($fileId: ID!, $chunkIndex: Int!) {
  chunkUrl(fileId: $fileId, chunkIndex: $chunkIndex)
}
"""

_CONFIG = """
query Config {
  config {
    defaultExpiry
    defaultNumberOfDownloads
    allowUploads
  }
}
"""


# ── Client ─────────────────────────────────────────────────────────────────


class Client:
    """Async GraphQL + S3 client for the Chithi backend."""

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
        self._graphql_url = self.urls.backend_url.rstrip("/") + "/graphql/"

    # ── context manager ────────────────────────────────────────────────────

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
        urls = UrlBuilder.resolve(initial_url)
        return cls(urls)

    # ── low-level GraphQL helper ───────────────────────────────────────────

    async def _gql(self, query: str, variables: dict[str, Any] | None = None) -> dict[str, Any]:
        """Send a plain JSON GraphQL request (no file upload)."""
        payload: dict[str, Any] = {"query": query, "variables": variables or {}}
        response = await self._session.post(
            self._graphql_url,
            json=payload,
            headers={"Content-Type": "application/json"},
        )
        response.raise_for_status()
        data = response.json()
        if "errors" in data:
            raise ConnectionError(f"GraphQL error: {data['errors']}")
        return data["data"]

    async def _gql_multipart(
        self,
        query: str,
        variables: dict[str, Any],
        file_field: str,
        file_bytes: bytes,
        filename: str,
    ) -> dict[str, Any]:
        """Send a multipart GraphQL request with a file upload.

        Follows the GraphQL Multipart Request Spec:
          operations  = JSON with the query + variables (file vars as null)
          map         = JSON mapping variable names to file part indices
          0           = the file blob
        """
        import json

        # Build the operations JSON (file variables are null in JSON)
        json_vars = {k: (None if k == file_field else v) for k, v in variables.items()}
        operations = json.dumps({"query": query, "variables": json_vars})
        mapping = json.dumps({file_field: ["0"]})

        files = {
            "operations": (None, operations, "application/json"),
            "map": (None, mapping, "application/json"),
            "0": (filename, file_bytes, "application/octet-stream"),
        }

        response = await self._session.post(self._graphql_url, files=files)
        response.raise_for_status()
        data = response.json()
        if "errors" in data:
            raise ConnectionError(f"GraphQL error: {data['errors']}")
        return data["data"]

    # ── public API ─────────────────────────────────────────────────────────

    async def get_config(self) -> dict[str, Any]:
        data = await self._gql(_CONFIG)
        config = data.get("config") or {}
        # Normalise camelCase → snake_case keys the CLI expects
        return {
            "default_expiry": config.get("defaultExpiry", 86400),
            "default_number_of_downloads": config.get("defaultNumberOfDownloads", 1),
            "allow_uploads": config.get("allowUploads", True),
        }

    async def upload_file(
        self,
        encrypted_data: bytes,
        filename: str,
        expire_after_n_download: int = 1,
        expire_after: int = 86400,
        number_of_files: int | None = None,
    ) -> dict[str, Any]:
        """Upload encrypted bytes in 50 MB chunks via the GraphQL chunked flow.

        Returns a dict with 'id' and 'key' (the file slug).
        """
        total_size = len(encrypted_data)
        chunk_count = max(1, -(-total_size // CHUNK_SIZE))  # ceil div

        # 1. Register the file
        reg_data = await self._gql(_REGISTER_FILE, {
            "filename": filename,
            "totalSize": total_size,
            "chunkCount": chunk_count,
            "expiresAt": expire_after,
            "expireAfterNDownload": expire_after_n_download,
            "numberOfFiles": number_of_files,
        })
        registered = reg_data["registerFile"]
        file_key: str = registered["key"]
        file_id: str = registered["id"]

        # 2. Upload each chunk
        for i in range(chunk_count):
            start = i * CHUNK_SIZE
            end = min(start + CHUNK_SIZE, total_size)
            chunk_bytes = encrypted_data[start:end]
            is_last = i == chunk_count - 1

            await self._gql_multipart(
                _UPLOAD_FILE_CHUNK,
                variables={
                    "fileKey": file_key,
                    "chunkIndex": i,
                    "chunk": None,
                    "isLast": is_last,
                },
                file_field="chunk",
                file_bytes=chunk_bytes,
                filename=f"chunk-{i}",
            )

        # 3. Complete the upload
        await self._gql(_COMPLETE_UPLOAD, {"fileId": file_id})

        return {"id": file_id, "key": file_key}

    async def download_file(self, slug: str) -> bytes:
        """Download a file chunk-by-chunk from S3 via presigned URLs.

        Returns the reassembled encrypted bytes.
        """
        # 1. Get file info
        info_data = await self._gql(_FILE_INFO, {"slug": slug})
        info = info_data["fileInfo"]
        if info is None:
            raise ConnectionError("File not found")
        if info["isExpired"]:
            raise ConnectionError("File has expired")

        chunk_count: int = info["chunkCount"]
        file_id: str = info["id"]

        # 2. Fetch each chunk from S3
        chunks: list[bytes] = []
        for i in range(chunk_count):
            url_data = await self._gql(_CHUNK_URL, {"fileId": file_id, "chunkIndex": i})
            url: str = url_data["chunkUrl"]
            if not url:
                raise ConnectionError(f"No presigned URL for chunk {i}")

            async with self._session.stream("GET", url) as resp:
                resp.raise_for_status()
                chunks.append(b"".join([c async for c in resp.aiter_bytes()]))

        return b"".join(chunks)
