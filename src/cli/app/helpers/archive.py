from pathlib import Path

from app.chithi_core_bridge import chithi_core
from app.chithi_exceptions import ChithiError, CryptoError, ValidationError
from app.chithi_types import EncryptedBundle

__all__ = [
    "compress_and_encrypt",
    "decrypt_and_decompress",
    "read_file_entry",
    "read_directory_entries",
    "EncryptedBundle",
]


def read_file_entry(filepath: Path) -> tuple[str, bytes]:
    """Read a single file and return (name, data)."""
    path = Path(filepath)
    if not path.exists():
        raise ValidationError(f"File not found: {path}")
    if not path.is_file():
        raise ValidationError(f"Not a file: {path}")
    return (path.name, path.read_bytes())


def read_directory_entries(dirpath: Path) -> list[tuple[str, bytes]]:
    """Read all files in a directory and return list of (relative_path, data)."""
    path = Path(dirpath)
    if not path.exists():
        raise ValidationError(f"Directory not found: {path}")
    if not path.is_dir():
        raise ValidationError(f"Not a directory: {path}")

    entries: list[tuple[str, bytes]] = []
    for f in sorted(path.rglob("*")):
        if f.is_file():
            rel = str(f.relative_to(path))
            entries.append((rel, f.read_bytes()))
    return entries


def compress_and_encrypt(
    source: Path, *, password: str
) -> EncryptedBundle:
    """Compress and encrypt a file or directory.

    Pipeline:
    1. Read file(s) into memory
    2. Compress into 7z archive (LZMA2)
    3. Split into 32KB chunks
    4. Encrypt each chunk with AES-256-GCM (parallel across all cores)
    5. Sign bundle with Ed25519

    Args:
        source: Path to a file or directory.
        password: Encryption password.

    Returns:
        EncryptedBundle containing the encrypted data and crypto metadata.
    """
    if source.is_file():
        files = [(source.name, source.read_bytes())]
    else:
        files = read_directory_entries(source)

    if not files:
        raise ValidationError("No files to encrypt")
    if not password:
        raise ValidationError("Password must not be empty")

    try:
        bundle_bytes = chithi_core.upload(files, password)
    except ValueError as e:
        raise ChithiError(str(e)) from e

    return EncryptedBundle(bytes(bundle_bytes))


def decrypt_and_decompress(
    bundle: EncryptedBundle | bytes,
    output_dir: Path,
    *,
    password: str,
) -> list[Path]:
    """Decrypt and decompress a bundle to disk.

    Pipeline:
    1. Verify Ed25519 signature
    2. Derive encryption key (Argon2id + HKDF)
    3. Decrypt chunks with AES-256-GCM (parallel across all cores)
    4. Decompress 7z archive (LZMA2)
    5. Write files to output directory

    Args:
        bundle: Encrypted bundle or raw bytes.
        output_dir: Directory to write files to.
        password: Decryption password.

    Returns:
        List of Path objects for the written files.
    """
    if not password:
        raise ValidationError("Password must not be empty")

    raw_bytes: bytes = bundle.raw if isinstance(bundle, EncryptedBundle) else bytes(bundle)

    try:
        raw_files = chithi_core.download(raw_bytes, password)
    except ValueError as e:
        raise CryptoError(f"Decryption failed: {e}") from e

    output_dir.mkdir(parents=True, exist_ok=True)
    written: list[Path] = []

    for name, data in raw_files:
        dest = output_dir / name
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(bytes(data))
        written.append(dest)

    return written
