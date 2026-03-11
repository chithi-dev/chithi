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
    def __init__(self, instance_url: str | UrlBuilder):
        self.urls = (
            instance_url
            if isinstance(instance_url, UrlBuilder)
            else UrlBuilder(instance_url)
        )
        self._session = requests.Session()
        self._session.headers.update(
            {
                "Origin": self.urls.instance_url,
                "Referer": self.urls.instance_url,
            }
        )

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        self.close()

    def close(self):
        self._session.close()

    @classmethod
    def resolve(cls, instance_url: str | None = None) -> "Client":
        """Resolve instance URL from arg/env/prompt and return Client."""
        urls = UrlBuilder.resolve(instance_url)
        return cls(urls)

    def upload_file(
        self,
        file_path: Path,
        filename: str | None = None,
        expire_after_n_download: int | None = None,
        expire_after: int | None = None,
    ) -> dict:
        """
        Stream-upload *file_path* to ``POST /upload`` on the backend.
        Returns the JSON response (contains the download key).
        """
        if expire_after_n_download is None:
            expire_after_n_download = settings.EXPIRE_AFTER_N_DOWNLOAD

        if expire_after is None:
            expire_after = settings.EXPIRE_AFTER

        if expire_after_n_download is None or expire_after is None:
            config = self.get_config()
            if expire_after_n_download is None:
                expire_after_n_download = config["default_number_of_downloads"]
            if expire_after is None:
                expire_after = config["default_expiry"]

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

            response = self._session.post(
                upload_url,
                data=data,
                files=files,
                timeout=(30, None),
            )
            response.raise_for_status()
            return response.json()

    def get_config(self) -> dict:
        """Fetch the server configuration."""
        url = self.urls.config_url()
        response = self._session.get(url, timeout=30)
        response.raise_for_status()
        return response.json()

    def download_to_file(self, key: str, dest: Path) -> Path:
        """
        Stream-download a file and write it to *dest* with a progress bar.
        Returns *dest*.
        """
        download_url = f"{self.urls.download_url()}{key}"

        with self._session.get(
            download_url, stream=True, timeout=(30, None)
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
                for chunk in response.iter_content(STREAM_CHUNK_SIZE):
                    f.write(chunk)
                    pbar.update(len(chunk))
        return dest
