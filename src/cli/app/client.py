from pathlib import Path
from types import TracebackType
from typing import Any, BinaryIO, Self, cast

import httpx2
from tqdm import tqdm

from app.builder.urls import UrlBuilder
from app.settings import settings

# Stream in 8 MiB chunks (matches S3 multipart minimum)
STREAM_CHUNK_SIZE = 8 * 1024 * 1024

DEFAULT_TIMEOUT = httpx2.Timeout(connect=30.0, read=None, write=None, pool=None)


class _ProgressReader:
    """Wraps a file object and updates a tqdm bar on every read."""

    def __init__(self, fp: BinaryIO, pbar: tqdm) -> None:
        """Create a progress-aware wrapper around a binary file object."""
        self._fp = fp
        self._pbar = pbar

    def read(self, size: int = -1) -> bytes:
        """Read bytes and advance the progress bar."""
        data = self._fp.read(size)
        if data:
            self._pbar.update(len(data))
        return data

    def seek(self, offset: int, whence: int = 0) -> int:
        """Seek within the wrapped file object."""
        return self._fp.seek(offset, whence)

    def tell(self) -> int:
        """Return the current stream position."""
        return self._fp.tell()

    def __getattr__(self, name: str) -> Any:
        """Delegate missing attributes to the wrapped file object."""
        return getattr(self._fp, name)


class Client:
    """Async API client for uploads and downloads."""

    def __init__(self, urls: UrlBuilder):
        """
        Initialize with a UrlBuilder instance.
        Uses backend_url for API calls and frontend_url for headers.
        """
        self.urls = urls
        # Set headers based on the frontend URL to avoid CORS/Security issues
        self._session = httpx2.AsyncClient(
            headers={
                "Origin": self.urls.frontend_url.rstrip("/"),
                "Referer": self.urls.frontend_url,
                "Accept-Encoding": "br, zstd, gzip, deflate",
            },
            timeout=DEFAULT_TIMEOUT,
            follow_redirects=True,
            http2=True,
        )

    async def __aenter__(self) -> Self:
        """Enter the async context manager."""
        return self

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc_value: BaseException | None,
        traceback: TracebackType | None,
    ) -> None:
        """Exit the async context manager and close the session."""
        await self.close()

    async def close(self) -> None:
        """Close the underlying HTTP session."""
        await self._session.aclose()

    @classmethod
    def resolve(cls, initial_url: str | None = None) -> Self:
        """Resolve URLs via UrlBuilder and return a Client."""
        urls = UrlBuilder.resolve(initial_url)
        return cls(urls)

    async def get_config(self) -> dict[str, Any]:
        """Fetch the server configuration using the backend URL."""
        url = self.urls.config_url()
        response = await self._session.get(url)
        response.raise_for_status()
        return cast(dict[str, Any], response.json())

    async def upload_file(
        self,
        file_path: Path,
        filename: str | None = None,
        expire_after_n_download: int | None = None,
        expire_after: int | None = None,
    ) -> dict[str, Any]:
        """
        Stream-upload *file_path* to the backend.
        Uses the resolved backend_url/upload endpoint.
        """
        # Resolve expiration settings
        expire_n = expire_after_n_download or settings.EXPIRE_AFTER_N_DOWNLOAD
        expire_t = expire_after or settings.EXPIRE_AFTER

        # Fallback to server defaults if not set locally
        if expire_n is None or expire_t is None:
            config = await self.get_config()
            if expire_n is None:
                default_n = config.get("default_number_of_downloads", 1)
                expire_n = int(default_n) if default_n is not None else 1
            if expire_t is None:
                default_t = config.get("default_expiry", 86400)
                expire_t = int(default_t) if default_t is not None else 86400

        assert expire_n is not None
        assert expire_t is not None

        upload_url = self.urls.upload_url()
        display_name = filename or file_path.name
        file_size = file_path.stat().st_size

        with (
            open(file_path, "rb") as f,
            tqdm(
                total=file_size,
                unit="B",
                unit_scale=True,
                desc="Uploading",
                leave=False,
            ) as pbar,
        ):
            wrapped = _ProgressReader(f, pbar)
            wrapped_io = cast(BinaryIO, wrapped)

            # Multipart form data
            files = {"file": (display_name, wrapped_io, "application/octet-stream")}
            data = {
                "filename": display_name,
                "expire_after_n_download": str(expire_n),
                "expire_after": str(expire_t),
            }

            response = await self._session.post(upload_url, data=data, files=files)

            # If the backend returned HTML (redirect/error), catch it here
            if "text/html" in response.headers.get("Content-Type", ""):
                raise ConnectionError(
                    f"Upload failed: Server returned HTML instead of JSON from {upload_url}"
                )

            response.raise_for_status()
            return cast(dict[str, Any], response.json())

    async def download_to_file(self, key: str, dest: Path) -> Path:
        """Stream-download a file using the backend URL."""
        download_url = f"{self.urls.download_url()}{key}"

        async with self._session.stream("GET", download_url) as response:
            # Validation: Catch frontend HTML responses before they hit the crypto layer
            content_type = response.headers.get("Content-Type", "")
            if "text/html" in content_type:
                raise ConnectionError(
                    f"Expected binary file, but got HTML. Your API URL is likely wrong.\n"
                    f"Attempted URL: {download_url}"
                )

            response.raise_for_status()
            total = int(response.headers.get("content-length", 0)) or None

            with (
                open(dest, "wb") as f,
                tqdm(
                    total=total,
                    unit="B",
                    unit_scale=True,
                    desc="Downloading",
                    leave=False,
                ) as pbar,
            ):
                async for chunk in response.aiter_bytes(STREAM_CHUNK_SIZE):
                    f.write(chunk)
                    pbar.update(len(chunk))
        return dest
