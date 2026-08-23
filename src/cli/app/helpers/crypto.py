from app.chithi_core_bridge import chithi_core
from app.chithi_exceptions import ChithiError, CryptoError, ValidationError
from app.chithi_types import EncryptedBundle

__all__ = [
    "encrypt_files",
    "decrypt_bundle",
    "encrypt_data",
    "decrypt_data",
    "ChithiError",
    "CryptoError",
    "ValidationError",
    "EncryptedBundle",
]


def encrypt_files(files: list[tuple[str, bytes]], *, password: str) -> EncryptedBundle:
    """Compress and encrypt files into an encrypted bundle.

    Pipeline:
    1. Files are compressed into a 7z archive (LZMA2)
    2. Archive is split into 32KB chunks
    3. Each chunk is encrypted with AES-256-GCM (parallel across all cores)
    4. Bundle is signed with Ed25519

    Args:
        files: List of (filename, data) tuples.
        password: Encryption password.

    Returns:
        EncryptedBundle containing the encrypted data and crypto metadata.
    """
    if not password:
        raise ValidationError("Password must not be empty")
    if not files:
        raise ValidationError("At least one file is required")

    try:
        bundle_bytes = chithi_core.upload(files, password)
    except ValueError as e:
        raise ChithiError(str(e)) from e

    return EncryptedBundle(bytes(bundle_bytes))


def decrypt_bundle(
    bundle: EncryptedBundle | bytes, *, password: str
) -> list[tuple[str, bytes]]:
    """Decrypt and decompress an encrypted bundle.

    Pipeline:
    1. Verify Ed25519 signature
    2. Derive encryption key from password (Argon2id + HKDF)
    3. Decrypt chunks with AES-256-GCM (parallel across all cores)
    4. Decompress 7z archive (LZMA2)

    Args:
        bundle: Encrypted bundle from encrypt_files() or raw bytes.
        password: The same password used during encryption.

    Returns:
        List of (filename, data) tuples matching the original files.
    """
    if not password:
        raise ValidationError("Password must not be empty")

    raw_bytes: bytes = bundle.raw if isinstance(bundle, EncryptedBundle) else bytes(bundle)

    try:
        raw_files = chithi_core.download(raw_bytes, password)
    except ValueError as e:
        raise CryptoError(f"Decryption failed: {e}") from e

    return [(name, bytes(data)) for name, data in raw_files]


def encrypt_data(data: bytes, *, password: str) -> bytes:
    """Encrypt raw data without compression.

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


def decrypt_data(bundle_json: bytes, *, password: str) -> bytes:
    """Decrypt raw data (no decompression).

    Args:
        bundle_json: JSON-serialized bundle from encrypt_data().
        password: The same password used during encrypt_data().

    Returns:
        Decrypted raw bytes.
    """
    if not password:
        raise ValidationError("Password must not be empty")

    try:
        return bytes(chithi_core.download_data(bundle_json, password))
    except ValueError as e:
        raise CryptoError(f"Decryption failed: {e}") from e
