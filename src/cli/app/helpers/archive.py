"""Compress/encrypt and decrypt/decompress helpers for the CLI."""

from pathlib import Path

import anyio

from app.chithi_exceptions import ChithiError, CryptoError, ValidationError
from app.chithi_types import EncryptedBundle
from app.helpers.crypto import decrypt_bundle, encrypt_files

__all__ = [
    "compress_and_encrypt",
    "decrypt_and_decompress",
    "EncryptedBundle",
]


def _read_directory_entries(path: Path) -> list[tuple[str, bytes]]:
    if not path.exists():
        raise ValidationError(f"Directory not found: {path}")
    if not path.is_dir():
        raise ValidationError(f"Not a directory: {path}")

    return [
        (str(f.relative_to(path)).replace("\\", "/"), f.read_bytes())
        for f in sorted(path.rglob("*"))
        if f.is_file()
    ]


async def compress_and_encrypt(source: Path, *, password: str) -> EncryptedBundle:
    """Compress and encrypt a file or directory into an EncryptedBundle.

    Pipeline: read files -> 7z -> AES-256-GCM ECE.
    """
    if not password:
        raise ValidationError("Password must not be empty")

    files = await anyio.to_thread.run_sync(
        lambda: [(source.name, source.read_bytes())]
        if source.is_file()
        else _read_directory_entries(source)
    )

    if not files:
        raise ValidationError("No files to encrypt")

    try:
        return await encrypt_files(files, password=password)
    except (ValidationError, CryptoError):
        raise
    except Exception as exc:
        raise ChithiError(str(exc)) from exc


async def decrypt_and_decompress(
    bundle: EncryptedBundle | bytes,
    output_dir: Path,
    *,
    password: str,
) -> list[Path]:
    """Decrypt and write files to disk.

    Pipeline: derive key -> decrypt ECE records -> 7z extract -> write files.
    """
    if not password:
        raise ValidationError("Password must not be empty")

    raw_bytes = bundle.raw if isinstance(bundle, EncryptedBundle) else bytes(bundle)

    try:
        raw_files = await decrypt_bundle(raw_bytes, password=password)
    except (ValidationError, CryptoError):
        raise
    except Exception as exc:
        raise CryptoError(f"Decryption failed: {exc}") from exc

    output_dir.mkdir(parents=True, exist_ok=True)

    def _write_files() -> list[Path]:
        written: list[Path] = []
        for name, data in raw_files:
            dest = output_dir / name
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(data)
            written.append(dest)
        return written

    return await anyio.to_thread.run_sync(_write_files)
