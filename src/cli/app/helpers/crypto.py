"""Pure-Python ECE encryption/decryption — mirrors the Web Crypto pipeline exactly.

Scheme v3 (must match src/frontend/src/lib/consts/encryption.ts, streams.ts and
crypto.worker.ts):
  1. IKM resolution:
       password path → Argon2id(password, header_salt, t=3, m=64 MiB, p=1) → 32 bytes
       secret path   → 32-byte random IKM (zero-knowledge root, lives in URL fragment)
  2. File key: HKDF-SHA-256(IKM, salt=header_salt, info=HKDF_FILE_INFO) → 32 bytes (AES-256)
  3. nonceBase: SHA-256(file_key)[0:12]
  4. Per-record nonce: nonceBase XOR (sequence_number as last 4 bytes, BE)
  5. Wire format: [16-byte random salt][1-byte version=3][4-byte record size, BE]
     [record_0][record_1]...
     Each record = AES-256-GCM(plaintext_chunk) — 64 KiB plaintext + 16-byte auth tag.

The header salt is REAL: it is fed to both Argon2id (password path) and HKDF (all
paths), so identical passwords over different uploads yield different keys and
ciphertexts (no cross-upload rainbow-table reuse).
"""

from __future__ import annotations

import base64
import hashlib
import os
import struct
from typing import TYPE_CHECKING

from argon2 import Type
from argon2.low_level import hash_secret_raw
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

from app.chithi_exceptions import CryptoError, ValidationError
from app.chithi_types import EncryptedBundle

if TYPE_CHECKING:
    from pathlib import Path

# ── Constants (must match src/frontend/src/lib/consts/encryption.ts) ────────
SCHEME_VERSION = 3
HKDF_FILE_INFO = b"chithi-file-key-v3"

# Argon2id parameters (OWASP 2024 minimum for interactive password use).
ARGON2_TIME_COST = 3
ARGON2_MEMORY_COST_KIB = 64 * 1024  # 64 MiB
ARGON2_PARALLELISM = 1
ARGON2_HASH_LENGTH = 32  # bytes → IKM

# File-key length: AES-256 (32 bytes).
FILE_KEY_LENGTH = 32

# ECE (RFC 8188) record size: 64 KiB.
RECORD_SIZE = 64 * 1024

# Wire header: [16B random salt][1B version][4B record_size BE] = 21 bytes.
SALT_LENGTH = 16
VERSION_LENGTH = 1
RECORD_SIZE_FIELD_LENGTH = 4
HEADER_LENGTH = SALT_LENGTH + VERSION_LENGTH + RECORD_SIZE_FIELD_LENGTH
TAG_LENGTH = 16
NONCE_LENGTH = 12


# ── Key derivation ──────────────────────────────────────────────────────────

def password_to_ikm(password: str, salt: bytes) -> bytes:
    """Derive 32-byte IKM from a password using Argon2id against the header salt."""
    return hash_secret_raw(
        secret=password.encode("utf-8"),
        salt=salt,
        time_cost=ARGON2_TIME_COST,
        memory_cost=ARGON2_MEMORY_COST_KIB,
        parallelism=ARGON2_PARALLELISM,
        hash_len=ARGON2_HASH_LENGTH,
        type=Type.ID,
    )


def derive_file_key(ikm: bytes, salt: bytes) -> bytes:
    """Derive the 32-byte AES-256 file key from IKM using HKDF-SHA-256."""
    hkdf = HKDF(
        algorithm=hashes.SHA256(),
        length=FILE_KEY_LENGTH,
        salt=salt,
        info=HKDF_FILE_INFO,
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


def resolve_ikm(password: str | None, secret_key: bytes | None, salt: bytes) -> bytes:
    """Resolve the IKM from either a password (Argon2id) or a raw secret key."""
    if password:
        return password_to_ikm(password, salt)
    if secret_key is not None:
        return secret_key
    raise ValidationError("Password or secret key required")


# ── Header helpers ──────────────────────────────────────────────────────────

def build_header(salt: bytes) -> bytes:
    """Build the 21-byte v3 header: [salt][version][record_size BE]."""
    return salt + bytes([SCHEME_VERSION]) + struct.pack(">I", RECORD_SIZE)


def parse_header(ciphertext: bytes) -> tuple[bytes, int, int]:
    """Parse the v3 header. Returns (salt, version, record_size)."""
    salt = ciphertext[:SALT_LENGTH]
    version = ciphertext[SALT_LENGTH]
    record_size = struct.unpack(">I", ciphertext[SALT_LENGTH + VERSION_LENGTH : SALT_LENGTH + VERSION_LENGTH + RECORD_SIZE_FIELD_LENGTH])[0]
    return salt, version, record_size


# ── ECE encrypt / decrypt ───────────────────────────────────────────────────

def ece_encrypt(plaintext: bytes, file_key: bytes, salt: bytes) -> bytes:
    """Encrypt plaintext using AES-256-GCM ECE.

    Args:
        salt: The per-file salt already used for key derivation — it must be the
              same salt that feeds Argon2id/HKDF, so it travels in the header.

    Returns: [16B salt][1B version=3][4B record_size BE][record_0][record_1]...
    """
    nonce_base = compute_nonce_base(file_key)
    aesgcm = AESGCM(file_key)

    header = build_header(salt)
    records = bytearray()

    offset = 0
    seq = 0
    while offset < len(plaintext):
        chunk = plaintext[offset : offset + RECORD_SIZE]
        nonce = record_nonce(nonce_base, seq)
        records.extend(aesgcm.encrypt(nonce, chunk, None))
        offset += RECORD_SIZE
        seq += 1

    return bytes(header) + bytes(records)


def ece_decrypt(ciphertext: bytes, file_key: bytes) -> bytes:
    """Decrypt ECE ciphertext.

    Input:  [16B salt][1B version=3][4B record_size BE][record_0][record_1]...
    Returns: plaintext bytes.
    """
    if len(ciphertext) < HEADER_LENGTH:
        raise CryptoError("Ciphertext too short")

    _salt, version, record_size = parse_header(ciphertext)
    if version != SCHEME_VERSION:
        raise CryptoError(f"Unsupported encryption version: {version} (expected {SCHEME_VERSION})")

    # The caller already resolved the IKM against the header salt (see decrypt_bundle /
    # decrypt_data) and derived the file key; we consume it as-is.
    nonce_base = compute_nonce_base(file_key)
    aesgcm = AESGCM(file_key)

    ct_record_size = record_size + TAG_LENGTH  # ciphertext size of a full record

    plaintext = bytearray()
    offset = HEADER_LENGTH
    seq = 0
    while offset < len(ciphertext):
        remaining = len(ciphertext) - offset
        # Full records are exactly ct_record_size bytes; the last record is shorter.
        chunk = ciphertext[offset : offset + ct_record_size] if remaining >= ct_record_size else ciphertext[offset:]
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
      2. Archive is encrypted with AES-256-GCM ECE (64 KiB records)
      3. Wire format: [16B salt][1B version=3][4B record_size][records...]

    Args:
        files: List of (filename, data) tuples.
        password: Encryption password (or pass secret_key directly).
        secret_key: Optional 32-byte IKM to skip Argon2id (for share-URL secrets).

    Returns:
        EncryptedBundle containing the ciphertext bytes.
    """
    if not files:
        raise ValidationError("At least one file is required")

    # Generate the per-file salt FIRST — it feeds both Argon2id (password path)
    # and HKDF (all paths), and travels in the wire header.
    salt = os.urandom(SALT_LENGTH)
    ikm = resolve_ikm(password or None, secret_key, salt)
    file_key = derive_file_key(ikm, salt)
    zip_bytes = files_to_zip(files)
    ciphertext = ece_encrypt(zip_bytes, file_key, salt)

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
        secret_key: Optional 32-byte IKM (alternative to password).

    Returns:
        List of (filename, data) tuples.
    """
    raw = bundle.raw if isinstance(bundle, EncryptedBundle) else bytes(bundle)

    if len(raw) < HEADER_LENGTH:
        raise CryptoError("Ciphertext too short")

    # Read the header salt — required to re-derive the IKM (password path) and
    # the file key (all paths).
    salt, version, _record_size = parse_header(raw)
    if version != SCHEME_VERSION:
        raise CryptoError(f"Unsupported encryption version: {version} (expected {SCHEME_VERSION})")

    ikm = resolve_ikm(password or None, secret_key, salt)
    file_key = derive_file_key(ikm, salt)
    zip_bytes = ece_decrypt(raw, file_key)

    return zip_to_files(zip_bytes)


def encrypt_data(data: bytes, *, password: str = "", secret_key: bytes | None = None) -> bytes:
    """Encrypt raw bytes (no compression) using the ECE wire format.

    Args:
        data: Raw bytes to encrypt.
        password: Encryption password.
        secret_key: Optional 32-byte IKM.

    Returns:
        Ciphertext bytes (ECE wire format).
    """
    if not data:
        raise ValidationError("Data must not be empty")

    salt = os.urandom(SALT_LENGTH)
    ikm = resolve_ikm(password or None, secret_key, salt)
    file_key = derive_file_key(ikm, salt)
    return ece_encrypt(data, file_key, salt)


def decrypt_data(ciphertext: bytes, *, password: str = "", secret_key: bytes | None = None) -> bytes:
    """Decrypt raw ECE ciphertext (no decompression).

    Args:
        ciphertext: ECE wire-format bytes.
        password: The password used during encryption.
        secret_key: Optional 32-byte IKM.

    Returns:
        Decrypted raw bytes.
    """
    if len(ciphertext) < HEADER_LENGTH:
        raise CryptoError("Ciphertext too short")

    salt, version, _record_size = parse_header(ciphertext)
    if version != SCHEME_VERSION:
        raise CryptoError(f"Unsupported encryption version: {version} (expected {SCHEME_VERSION})")

    ikm = resolve_ikm(password or None, secret_key, salt)
    file_key = derive_file_key(ikm, salt)
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
    "password_to_ikm",
    "derive_file_key",
    "compute_nonce_base",
    "record_nonce",
    "ece_encrypt",
    "ece_decrypt",
    "base64url_encode",
    "base64url_decode",
    "files_to_zip",
    "zip_to_files",
    "EncryptedBundle",
    "ValidationError",
    "CryptoError",
]
