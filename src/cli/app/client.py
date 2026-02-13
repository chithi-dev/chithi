"""Async HTTP client for communicating with the Chithi backend."""

from pathlib import Path
from typing import BinaryIO, cast, Optional

import httpx
from tqdm import tqdm

from app.builder.urls import UrlBuilder

# Stream in 8 MiB chunks (matches S3 multipart minimum)
STREAM_CHUNK_SIZE = 8 * 1024 * 1024


class _ProgressReader:
    """Wraps a file object and updates a tqdm bar on every read."""

    def __init__(self, fp, pbar: tqdm):
        self._fp = fp
        self._pbar = pbar

    def read(self, size: int = -1) -> bytes:
        data = self._fp.read(size)
        if data:
            self._pbar.update(len(data))
        return data

    def seek(self, offset: int, whence: int = 0) -> int:
        return self._fp.seek(offset, whence)

    def tell(self) -> int:
        return self._fp.tell()

    # httpx also checks for these
    def __getattr__(self, name):
        return getattr(self._fp, name)


class Client:
    def __init__(self, instance_url: str | UrlBuilder):
        self.urls = (
            instance_url
            if isinstance(instance_url, UrlBuilder)
            else UrlBuilder(instance_url)
        )
        headers = {
            "Origin": self.urls.instance_url,
            "Referer": self.urls.instance_url,
        }
        self._client = httpx.AsyncClient(follow_redirects=True, headers=headers)

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_value, traceback):
        await self.close()

    async def close(self):
        await self._client.aclose()

    @classmethod
    def resolve(cls, instance_url: str | None = None) -> "Client":
        """Resolve instance URL from arg/env/prompt and return Client."""
        urls = UrlBuilder.resolve(instance_url)
        return cls(urls)

    async def upload_file(
        self,
        file_path: Path,
        filename: str | None = None,
        expire_after_n_download: int = 1,
        expire_after: int = 86400,
        timeout: Optional[httpx.Timeout] = None,
    ) -> dict:
        """
        Stream-upload *file_path* to ``POST /upload`` on the backend.
        Returns the JSON response (contains the download key).
        """
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
            files = {"file": (display_name, wrapped_io, "application/octet-stream")}
            data = {
                "filename": display_name,
                "expire_after_n_download": str(expire_after_n_download),
                "expire_after": str(expire_after),
            }

            response = await self._client.post(
                upload_url,
                data=data,
                files=files,
                timeout=timeout,
            )
            response.raise_for_status()
            return response.json()

    async def get_config(self) -> dict:
        """Fetch the server configuration."""
        url = self.urls.config_url()
        response = await self._client.get(url)
        response.raise_for_status()
        return response.json()

    async def download_to_file(
        self,
        key: str,
        dest: Path,
        timeout: Optional[httpx.Timeout] = None,
    ) -> Path:
        """
        Stream-download a file and write it to *dest* with a progress bar.
        Returns *dest*.
        """
        # The URL pattern for download relies on the key being appended
        download_url = f"{self.urls.download_url()}{key}"

        async with self._client.stream(
            "GET",
            download_url,
            timeout=timeout,
        ) as response:
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
