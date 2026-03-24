"""HTTP client for communicating with the Chithi backend."""

from pathlib import Path
from typing import BinaryIO, cast

import requests
from tqdm import tqdm

from app.settings import settings
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

    def __getattr__(self, name):
        return getattr(self._fp, name)


class Client:
    def __init__(self, urls: UrlBuilder):
        """
        Initialize with a UrlBuilder instance.
        Uses backend_url for API calls and frontend_url for headers.
        """
        self.urls = urls
        self._session = requests.Session()

        # Set headers based on the frontend URL to avoid CORS/Security issues
        self._session.headers.update(
            {
                "Origin": self.urls.frontend_url.rstrip("/"),
                "Referer": self.urls.frontend_url,
            }
        )

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        self.close()

    def close(self):
        self._session.close()

    @classmethod
    def resolve(cls, initial_url: str | None = None) -> "Client":
        """Resolve URLs via UrlBuilder and return a Client."""
        urls = UrlBuilder.resolve(initial_url)
        return cls(urls)

    def get_config(self) -> dict:
        """Fetch the server configuration using the backend URL."""
        url = self.urls.config_url()
        response = self._session.get(url, timeout=30)
        response.raise_for_status()
        return response.json()

    def upload_file(
        self,
        file_path: Path,
        filename: str | None = None,
        expire_after_n_download: int | None = None,
        expire_after: int | None = None,
    ) -> dict:
        """
        Stream-upload *file_path* to the backend.
        Uses the resolved backend_url/upload endpoint.
        """
        # Resolve expiration settings
        expire_n = expire_after_n_download or settings.EXPIRE_AFTER_N_DOWNLOAD
        expire_t = expire_after or settings.EXPIRE_AFTER

        # Fallback to server defaults if not set locally
        if expire_n is None or expire_t is None:
            config = self.get_config()
            expire_n = expire_n or config.get("default_number_of_downloads")
            expire_t = expire_t or config.get("default_expiry")

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

            response = self._session.post(
                upload_url,
                data=data,
                files=files,
                timeout=(
                    30,
                    None,
                ),  # 30s connect timeout, infinite read timeout for large files
            )

            # If the backend returned HTML (redirect/error), catch it here
            if "text/html" in response.headers.get("Content-Type", ""):
                raise ConnectionError(
                    f"Upload failed: Server returned HTML instead of JSON from {upload_url}"
                )

            response.raise_for_status()
            return response.json()

    def download_to_file(self, key: str, dest: Path) -> Path:
        """Stream-download a file using the backend URL."""
        download_url = f"{self.urls.download_url()}{key}"

        with self._session.get(
            download_url, stream=True, timeout=(30, None)
        ) as response:
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
                for chunk in response.iter_content(STREAM_CHUNK_SIZE):
                    f.write(chunk)
                    pbar.update(len(chunk))
        return dest
