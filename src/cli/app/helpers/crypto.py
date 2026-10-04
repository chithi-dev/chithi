"""Pure-Python ECE encryption/decryption — mirrors the Web Crypto pipeline exactly.

Scheme (must match streams.ts and crypto.worker.ts):
  1. IKM resolution: PBKDF2-SHA-256(password, salt='chithi-salt-v2', 100_000) → 16 bytes
  2. File key: HKDF-SHA-256(IKM, salt='chithi-salt-v2', info='chithi-file-key-v2') → 16 bytes (AES-128)
  3. nonceBase: SHA-256(file_key)[0:12]
  4. Per-record nonce: nonceBase XOR (sequence_number as last 4 bytes, BE)
  5. Wire format: [16-byte random salt][4-byte record size, BE][record_0][record_1]...
     Each record = AES-128-GCM(plaintext_chunk) — 64 KiB plaintext + 16-byte auth tag.

The random salt in the header is for future extensibility; key derivation uses
the fixed HKDF_SALT_STR. The random salt is NOT used in key derivation in the
current implementation (matching the Web Crypto code path).
"""

from __future__ import annotations

import base64
import hashlib
import hmac as _hmac
import struct
import zlib
from dataclasses import dataclass

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes

from app.chithi_exceptions import CryptoError, ValidationError
from app.chithi_types import EncryptedBundle

# ── Constants (must match src/frontend/src/lib/consts/encryption.ts) ────────
HKDF_SALT_STR = b"chithi-salt-v2"
HKDF_FILE_INFO = b"chithi-file-key-v2"
HKDF_AUTH_INFO = b"chithi-auth-key-v2"
PBKDF2_ITERATIONS = 100_000
RECORD_SIZE = 64 * 1024
SALT_LENGTH = 16
HEADER_LENGTH = SALT_LENGTH + 4  # salt + record-size field
NONCE_LENGTH = 12


# ── Key derivation ──────────────────────────────────────────────────────────

def password_to_ikm(password: str) -> bytes:
    """Derive 16-byte IKM from a password using PBKDF2-SHA-256."""
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=16,
        salt=HKDF_SALT_STR,
        iterations=PBKDF2_ITERATIONS,
    )
    return kdf.derive(password.encode("utf-8"))


def derive_file_key(ikm: bytes) -> bytes:
    """Derive the 16-byte AES-128 file key from IKM using HKDF-SHA-256."""
    hkdf = HKDF(
        algorithm=hashes.SHA256(),
        length=16,
        salt=HKDF_SALT_STR,
        info=HKDF_FILE_INFO,
    )
    return hkdf.derive(ikm)


def derive_auth_key(ikm: bytes) -> bytes:
    """Derive the 32-byte HMAC-SHA-256 auth key from IKM using HKDF-SHA-256."""
    hkdf = HKDF(
        algorithm=hashes.SHA256(),
        length=32,
        salt=HKDF_SALT_STR,
        info=HKDF_AUTH_INFO,
    )
    return hkdf.derive(ikm)


def compute_nonce_base(file_key: bytes) -> bytes:
    """Derive the 12-byte nonceBase: SHA-256(file_key)[0:12]."""
    return hashlib.sha256(file_key).digest()[:NONCE_LENGTH]


def record_nonce(nonce_base: bytes, seq: int) -> bytes:
    """Compute per-record nonce: nonceBase XOR (seq as last 4 bytes, BE)."""
    nonce = bytearray(nonce_base)
    seq_bytes = struct.pack(">I", seq & 0xFFFFFFFF)
    for i in range(4):
        nonce[NONCE_LENGTH - 4 + i] ^= seq_bytes[i]
    return bytes(nonce)


# ── ECE encrypt / decrypt ───────────────────────────────────────────────────

def ece_encrypt(plaintext: bytes, file_key: bytes) -> bytes:
    """Encrypt plaintext using AES-128-GCM ECE.

    Returns: [16B salt][4B record_size BE][record_0][record_1]...
    """
    nonce_base = compute_nonce_base(file_key)
    aesgcm = AESGCM(file_key)

    # Random salt (matches streams.ts: crypto.getRandomValues(new Uint8Array(16)))
    import os
    salt = os.urandom(SALT_LENGTH)

    header = salt + struct.pack(">I", RECORD_SIZE)
    records = bytearray()

    offset = 0
    seq = 0
    while offset < len(plaintext):
        chunk = plaintext[offset: offset + RECORD_SIZE]
        nonce = record_nonce(nonce_base, seq)
        records.extend(aesgcm.encrypt(nonce, chunk, None))
        offset += RECORD_SIZE
        seq += 1

    return bytes(header) + bytes(records)


def ece_decrypt(ciphertext: bytes, file_key: bytes) -> bytes:
    """Decrypt ECE ciphertext.

    Input:  [16B salt][4B record_size BE][record_0][record_1]...
    Returns: plaintext bytes.
    """
    if len(ciphertext) < HEADER_LENGTH:
        raise CryptoError("Ciphertext too short")

    record_size = struct.unpack(">I", ciphertext[16:20])[0]
    nonce_base = compute_nonce_base(file_key)
    aesgcm = AESGCM(file_key)

    TAG_LEN = 16
    ct_record_size = record_size + TAG_LEN  # ciphertext size of a full record

    plaintext = bytearray()
    offset = HEADER_LENGTH
    seq = 0
    while offset < len(ciphertext):
        remaining = len(ciphertext) - offset
        # Full records are exactly ct_record_size bytes; the last record is shorter.
        chunk = ciphertext[offset: offset + ct_record_size] if remaining >= ct_record_size else ciphertext[offset:]
        nonce = record_nonce(nonce_base, seq)
        try:
            plaintext.extend(aesgcm.decrypt(nonce, chunk, None))
        except Exception as e:
            raise CryptoError(
                f"Decryption failed at record {seq} (wrong password or corrupted data)"
            ) from e
        offset += len(chunk)
        seq += 1

    return bytes(plaintext)


# ── Zip helpers (matches fflate in the frontend) ───────────────────────────

def files_to_zip(files: list[tuple[str, bytes]]) -> bytes:
    """Compress files into a zip archive (equivalent to fflate's zip())."""
    import zipfile
    import io

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
        for name, data in files:
            zf.writestr(name, data)
    return buf.getvalue()


def zip_to_files(zip_bytes: bytes) -> list[tuple[str, bytes]]:
    """Decompress a zip archive back into (name, data) tuples."""
    import zipfile
    import io

    files: list[tuple[str, bytes]] = []
    with zipfile.ZipFile(io.BytesIO(zip_bytes), "r") as zf:
        for info in zf.infolist():
            if not info.is_dir():
                files.append((info.filename, zf.read(info)))
    return files


# ── Public API ─────────────────────────────────────────────────────────────

def encrypt_files(
    files: list[tuple[str, bytes]],
    *,
    password: str = "",
    secret_key: bytes | None = None,
) -> EncryptedBundle:
    """Compress and encrypt files into an encrypted bundle.

    Pipeline:
      1. Files are compressed into a zip archive (zlib, level 6)
      2. Archive is encrypted with AES-128-GCM ECE (64 KiB records)
      3. Wire format: [16B salt][4B record_size][records...]

    Args:
        files: List of (filename, data) tuples.
        password: Encryption password (or pass secret_key directly).
        secret_key: Optional 16-byte IKM to skip PBKDF2 (for share-URL secrets).

    Returns:
        EncryptedBundle containing the ciphertext bytes.
    """
    if not files:
        raise ValidationError("At least one file is required")

    # Resolve IKM
    if secret_key is not None:
        ikm = secret_key
    elif password:
        ikm = password_to_ikm(password)
    else:
        raise ValidationError("Password or secret key required")

    file_key = derive_file_key(ikm)
    zip_bytes = files_to_zip(files)
    ciphertext = ece_encrypt(zip_bytes, file_key)

    return EncryptedBundle(ciphertext)


def decrypt_bundle(
    bundle: EncryptedBundle | bytes,
    *,
    password: str = "",
    secret_key: bytes | None = None,
) -> list[tuple[str, bytes]]:
    """Decrypt and decompress an encrypted bundle.

    Args:
        bundle: EncryptedBundle or raw ciphertext bytes.
        password: The password used during encryption.
        secret_key: Optional 16-byte IKM (alternative to password).

    Returns:
        List of (filename, data) tuples.
    """
    raw = bundle.raw if isinstance(bundle, EncryptedBundle) else bytes(bundle)

    if secret_key is not None:
        ikm = secret_key
    elif password:
        ikm = password_to_ikm(password)
    else:
        raise ValidationError("Password or secret key required")

    file_key = derive_file_key(ikm)
    zip_bytes = ece_decrypt(raw, file_key)

    return zip_to_files(zip_bytes)


def encrypt_data(data: bytes, *, password: str = "", secret_key: bytes | None = None) -> bytes:
    """Encrypt raw bytes (no compression) using the ECE wire format.

    Args:
        data: Raw bytes to encrypt.
        password: Encryption password.
        secret_key: Optional 16-byte IKM.

    Returns:
        Ciphertext bytes (ECE wire format).
    """
    if not data:
        raise ValidationError("Data must not be empty")

    if secret_key is not None:
        ikm = secret_key
    elif password:
        ikm = password_to_ikm(password)
    else:
        raise ValidationError("Password or secret key required")

    file_key = derive_file_key(ikm)
    return ece_encrypt(data, file_key)


def decrypt_data(ciphertext: bytes, *, password: str = "", secret_key: bytes | None = None) -> bytes:
    """Decrypt raw ECE ciphertext (no decompression).

    Args:
        ciphertext: ECE wire-format bytes.
        password: The password used during encryption.
        secret_key: Optional 16-byte IKM.

    Returns:
        Decrypted raw bytes.
    """
    if secret_key is not None:
        ikm = secret_key
    elif password:
        ikm = password_to_ikm(password)
    else:
        raise ValidationError("Password or secret key required")

    file_key = derive_file_key(ikm)
    return ece_decrypt(ciphertext, file_key)


# ── Base64url helpers (for URL fragment transport) ─────────────────────────

def base64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def base64url_decode(s: str) -> bytes:
    padded = s + "=" * (-len(s) % 4)
    return base64.urlsafe_b64decode(padded.encode("ascii"))


__all__ = [
    "encrypt_files",
    "decrypt_bundle",
    "encrypt_data",
    "decrypt_data",
    "base64url_encode",
    "base64url_decode",
    "files_to_zip",
    "zip_to_files",
    "EncryptedBundle",
    "ValidationError",
    "CryptoError",
]
