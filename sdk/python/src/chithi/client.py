"""HTTP client for interacting with a Chithi backend server.

Provides opinionated upload/download that handles compression, encryption,
HTTP transport, and decryption in one call.

Example:
    from chithi import ChithiClient

    client = ChithiClient(base_url="http://localhost:8000", password="secret")

    # Upload files and get shareable IDs
    share_ids = client.upload_files(["document.pdf", "image.png"])

    # Download files from the backend
    client.download_files(share_ids, output_dir="./downloads")
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import httpx

from .core import chithi_core
from .exceptions import ChithiError, CryptoError, ValidationError
from .types import EncryptedBundle


class ChithiClient:
    """Opinionated client for Chithi backend servers.

    Handles compression, encryption, HTTP transport, and decryption.
    Build CLI or GUI apps on top of this client.

    Args:
        base_url: Backend server URL (e.g., "http://localhost:8000")
        password: Encryption password for all operations
        timeout: Request timeout in seconds
        headers: Additional HTTP headers to send with every request

    Example:
        >>> client = ChithiClient("http://localhost:8000", password="secret")
        >>> ids = client.upload_files(["file.pdf"])
        >>> client.download_files(ids, output_dir=".")
    """

    def __init__(
        self,
        base_url: str,
        *,
        password: str,
        timeout: float = 60.0,
        headers: dict[str, str] | None = None,
    ):
        if not password:
            raise ValidationError("Password must not be empty")

        self._client = httpx.Client(
            base_url=base_url.rstrip("/"),
            timeout=timeout,
            headers=headers or {},
        )
        self._password = password

    def close(self) -> None:
        """Close the underlying HTTP client."""
        self._client.close()

    def __enter__(self) -> ChithiClient:
        return self

    def __exit__(self, *args: Any) -> None:
        self.close()

    # ------------------------------------------------------------------
    # Upload
    # ------------------------------------------------------------------

    def upload_files(
        self,
        filepaths: list[str | Path],
        *,
        metadata: dict[str, str] | None = None,
    ) -> list[str]:
        """Upload files to the backend server.

        Each file is compressed into a 7z archive, encrypted with AES-256-GCM,
        and sent to the backend. Returns share IDs for each uploaded file.

        Args:
            filepaths: List of file paths to upload.
            metadata: Optional metadata to send with the upload.

        Returns:
            List of share IDs returned by the backend.

        Raises:
            ValidationError: If any file is not found.
            ChithiError: If the backend returns an error.
        """
        files_data = []
        for fp in filepaths:
            path = Path(fp)
            if not path.exists():
                raise ValidationError(f"File not found: {path}")
            if not path.is_file():
                raise ValidationError(f"Not a file: {path}")
            files_data.append((path.name, path.read_bytes()))

        bundle = self._encrypt_files(files_data)

        payload = {
            "bundle": bundle.raw.hex(),
            "metadata": metadata or {},
        }

        resp = self._client.post("/api/upload", json=payload)

        if resp.status_code != 200:
            raise ChithiError(
                f"Upload failed: {resp.status_code} - {resp.text}"
            )

        result = resp.json()
        return [item["id"] for item in result.get("shares", result.get("items", [result]))]

    def upload_data(
        self,
        data: bytes,
        *,
        label: str = "data",
        metadata: dict[str, str] | None = None,
    ) -> str:
        """Upload raw encrypted data to the backend.

        Args:
            data: Raw bytes to encrypt and upload.
            label: Label for this upload (used in responses).
            metadata: Optional metadata to send with the upload.

        Returns:
            Share ID returned by the backend.
        """
        encrypted = bytes(chithi_core.upload_data(data, self._password))

        payload = {
            "bundle": encrypted.hex(),
            "label": label,
            "metadata": metadata or {},
        }

        resp = self._client.post("/api/upload", json=payload)

        if resp.status_code != 200:
            raise ChithiError(
                f"Upload failed: {resp.status_code} - {resp.text}"
            )

        result = resp.json()
        return result.get("id", result.get("share_id", ""))

    # ------------------------------------------------------------------
    # Download
    # ------------------------------------------------------------------

    def download_files(
        self,
        share_ids: list[str],
        *,
        output_dir: str | Path = ".",
    ) -> list[Path]:
        """Download and decrypt files from the backend.

        Args:
            share_ids: List of share IDs to download.
            output_dir: Directory to write downloaded files.

        Returns:
            List of Path objects for the written files.
        """
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
        all_written: list[Path] = []

        for share_id in share_ids:
            bundle = self._fetch_bundle(share_id)
            files = self._decrypt_bundle(bundle)

            for name, data in files:
                dest = output_path / name
                dest.parent.mkdir(parents=True, exist_ok=True)
                dest.write_bytes(data)
                all_written.append(dest)

        return all_written

    def download_data(
        self,
        share_id: str,
    ) -> bytes:
        """Download and decrypt raw data from the backend.

        Args:
            share_id: Share ID to download.

        Returns:
            Decrypted raw bytes.
        """
        bundle_json = self._fetch_bundle(share_id)
        return bytes(chithi_core.download_data(bundle_json, self._password))

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _encrypt_files(
        self,
        files: list[tuple[str, bytes]],
    ) -> EncryptedBundle:
        """Compress and encrypt files."""
        raw = chithi_core.upload(files, self._password)
        return EncryptedBundle(bytes(raw))

    def _decrypt_bundle(
        self,
        bundle_bytes: bytes,
    ) -> list[tuple[str, bytes]]:
        """Decrypt and decompress a bundle."""
        raw_files = chithi_core.download(bundle_bytes, self._password)
        return [(name, bytes(data)) for name, data in raw_files]

    def _fetch_bundle(self, share_id: str) -> bytes:
        """Fetch an encrypted bundle from the backend by share ID."""
        resp = self._client.get(f"/api/download/{share_id}")

        if resp.status_code == 404:
            raise ChithiError(f"Share not found: {share_id}")
        if resp.status_code != 200:
            raise ChithiError(
                f"Download failed: {resp.status_code} - {resp.text}"
            )

        result = resp.json()
        bundle_hex = result.get("bundle", result.get("data", ""))
        return bytes.fromhex(bundle_hex)
