"""
Chithi SDK — Encrypted file upload/download.

Parallel compression (LZMA2) and encryption (AES-256-GCM) with
Argon2id key derivation. Uses all available CPU cores via Rayon.

Example:
    from chithi import Chithi

    chithi = Chithi()

    # Upload files
    bundle = chithi.upload(
        files=[("document.pdf", open("doc.pdf", "rb").read())],
        password="my-secure-password",
    )

    # Download files
    files = chithi.download(bundle, password="my-secure-password")
    for name, data in files:
        print(f"{name}: {len(data)} bytes")
"""

from __future__ import annotations

from pathlib import Path
from typing import BinaryIO, Iterable, List, Optional, Sequence, Tuple, Union

from .client import ChithiClient
from .core import chithi_core  # noqa: F401  # re-export the native module
from .exceptions import ChithiError, CryptoError, ValidationError
from .types import EncryptedBundle, FileEntry

__all__ = [
    "Chithi",
    "ChithiClient",
    "EncryptedBundle",
    "FileEntry",
    "ChithiError",
    "CryptoError",
    "ValidationError",
]

# Type alias for file input: list of (name, bytes) tuples
FilesInput = Sequence[Tuple[str, bytes]]


class Chithi:
    """Chithi SDK client for encrypted file upload/download.

    All encryption operations release the Python GIL and run in parallel
    across all available CPU cores via Rayon.

    Example:
        >>> chithi = Chithi()
        >>> bundle = chithi.upload([("file.txt", b"hello")], password="secret")
        >>> files = chithi.download(bundle, password="secret")
    """

    def upload(
        self,
        files: FilesInput | Iterable[Tuple[str, bytes]],
        *,
        password: str,
    ) -> EncryptedBundle:
        """Compress and encrypt files into an encrypted bundle.

        Pipeline:
        1. Files are compressed into a 7z archive (LZMA2)
        2. Archive is split into 32KB chunks
        3. Each chunk is encrypted with AES-256-GCM (parallel across all cores)
        4. Bundle is signed with Ed25519

        Args:
            files: Sequence of (filename, data) tuples.
                   Filenames should be relative paths.
            password: Encryption password. Must be non-empty.
                      Key is derived via Argon2id + HKDF-SHA256.

        Returns:
            EncryptedBundle containing the encrypted data and crypto metadata.

        Raises:
            ValidationError: If files is empty or password is invalid.
            CryptoError: If compression or encryption fails.
        """
        if not password:
            raise ValidationError("Password must not be empty")

        file_list: List[Tuple[str, bytes]] = list(files)
        if not file_list:
            raise ValidationError("At least one file is required")

        # Validate file entries
        for i, (name, data) in enumerate(file_list):
            if not name:
                raise ValidationError(f"File entry {i}: filename must not be empty")
            if not isinstance(data, (bytes, bytearray)):
                raise ValidationError(f"File entry {i}: data must be bytes")

        try:
            bundle_bytes = chithi_core.upload(file_list, password)
        except ValueError as e:
            raise ChithiError(str(e)) from e

        return EncryptedBundle(bytes(bundle_bytes))

    def download(
        self,
        bundle: EncryptedBundle | bytes,
        *,
        password: str,
    ) -> List[Tuple[str, bytes]]:
        """Decrypt and decompress an encrypted bundle.

        Pipeline:
        1. Verify Ed25519 signature
        2. Derive encryption key from password (Argon2id + HKDF)
        3. Decrypt each 32KB chunk with AES-256-GCM (parallel across all cores)
        4. Decompress 7z archive (LZMA2)

        Args:
            bundle: Encrypted bundle from upload() or raw bytes.
            password: The same password used during upload.

        Returns:
            List of (filename, data) tuples matching the original files.

        Raises:
            ValidationError: If bundle is malformed or password is invalid.
            CryptoError: If decryption or decompression fails.
        """
        if not password:
            raise ValidationError("Password must not be empty")

        raw_bytes: bytes = bundle.raw if isinstance(bundle, EncryptedBundle) else bytes(bundle)

        try:
            raw_files = chithi_core.download(raw_bytes, password)
        except ValueError as e:
            raise CryptoError(f"Decryption failed: {e}") from e

        return [(name, bytes(data)) for name, data in raw_files]

    def upload_data(
        self,
        data: bytes,
        *,
        password: str,
    ) -> bytes:
        """Encrypt raw data without compression.

        Useful for already-compressed data or streaming scenarios.

        Args:
            data: Raw bytes to encrypt.
            password: Encryption password.

        Returns:
            JSON-serialized encrypted bundle as bytes.
        """
        if not data:
            raise ValidationError("Data must not be empty")
        if not password:
            raise ValidationError("Password must not be empty")

        try:
            return bytes(chithi_core.upload_data(data, password))
        except ValueError as e:
            raise ChithiError(str(e)) from e

    def download_data(
        self,
        bundle_json: bytes,
        *,
        password: str,
    ) -> bytes:
        """Decrypt raw data (no decompression).

        Args:
            bundle_json: JSON-serialized bundle from upload_data().
            password: The same password used during upload_data().

        Returns:
            Decrypted raw bytes.
        """
        if not password:
            raise ValidationError("Password must not be empty")

        try:
            return bytes(chithi_core.download_data(bundle_json, password))
        except ValueError as e:
            raise CryptoError(f"Decryption failed: {e}") from e

    def upload_file(
        self,
        filepath: str | Path,
        *,
        password: str,
    ) -> EncryptedBundle:
        """Upload a single file from disk.

        Args:
            filepath: Path to the file to upload.
            password: Encryption password.

        Returns:
            Encrypted bundle.
        """
        path = Path(filepath)
        if not path.exists():
            raise ValidationError(f"File not found: {path}")
        if not path.is_file():
            raise ValidationError(f"Not a file: {path}")

        data = path.read_bytes()
        return self.upload([(path.name, data)], password=password)

    def download_to(
        self,
        bundle: EncryptedBundle | bytes,
        output_dir: str | Path,
        *,
        password: str,
    ) -> List[Path]:
        """Download and write files to disk.

        Args:
            bundle: Encrypted bundle.
            output_dir: Directory to write files to.
            password: Decryption password.

        Returns:
            List of Path objects for the written files.
        """
        path = Path(output_dir)
        path.mkdir(parents=True, exist_ok=True)

        files = self.download(bundle, password=password)
        written: List[Path] = []

        for name, data in files:
            dest = path / name
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(data)
            written.append(dest)

        return written
