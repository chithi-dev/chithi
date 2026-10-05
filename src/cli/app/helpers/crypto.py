"""Pure-Python ECE encryption/decryption, mirroring the Web Crypto pipeline.

Scheme v3 (must match src/frontend/src/lib/consts/encryption.ts, streams.ts and
crypto.worker.ts):
  1. IKM resolution:
       password path -> Argon2id(password, header_salt, t=3, m=64 MiB, p=1) -> 32 bytes
       secret path   -> 32-byte random IKM (zero-knowledge root, lives in URL fragment)
  2. File key: HKDF-SHA-256(IKM, salt=header_salt, info=HKDF_FILE_INFO) -> 32 bytes
  3. nonceBase: SHA-256(file_key)[0:12]
  4. Per-record nonce: nonceBase XOR (sequence_number as last 4 bytes, BE)
  5. Wire format: [16-byte random salt][1-byte version=3][4-byte record size, BE]
     [record_0][record_1]...
     Each record = AES-256-GCM(plaintext_chunk), 64 KiB plaintext + 16-byte auth tag.

The header salt is real: it is fed to both Argon2id (password path) and HKDF
(all paths), so identical passwords over different uploads yield different keys
and ciphertexts.
"""

import base64
import hashlib
import os
import struct

import anyio
from argon2 import Type
from argon2.low_level import hash_secret_raw
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

from app.chithi_exceptions import CryptoError, ValidationError
from app.chithi_types import EncryptedBundle

SCHEME_VERSION = 3
HKDF_FILE_INFO = b"chithi-file-key-v3"

ARGON2_TIME_COST = 3
ARGON2_MEMORY_COST_KIB = 64 * 1024
ARGON2_PARALLELISM = 1
ARGON2_HASH_LENGTH = 32

FILE_KEY_LENGTH = 32
RECORD_SIZE = 64 * 1024

SALT_LENGTH = 16
VERSION_LENGTH = 1
RECORD_SIZE_FIELD_LENGTH = 4
HEADER_LENGTH = SALT_LENGTH + VERSION_LENGTH + RECORD_SIZE_FIELD_LENGTH
TAG_LENGTH = 16
NONCE_LENGTH = 12


async def password_to_ikm(password: str, salt: bytes) -> bytes:
    """Derive 32-byte IKM from a password using Argon2id against the header salt."""
    return await anyio.to_thread.run_sync(
        lambda: hash_secret_raw(
            secret=password.encode("utf-8"),
            salt=salt,
            time_cost=ARGON2_TIME_COST,
            memory_cost=ARGON2_MEMORY_COST_KIB,
            parallelism=ARGON2_PARALLELISM,
            hash_len=ARGON2_HASH_LENGTH,
            type=Type.ID,
        )
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


async def resolve_ikm(password: str | None, secret_key: bytes | None, salt: bytes) -> bytes:
    """Resolve the IKM from either a password (Argon2id) or a raw secret key."""
    if password:
        return await password_to_ikm(password, salt)
    if secret_key is not None:
        return secret_key
    raise ValidationError("Password or secret key required")


def build_header(salt: bytes) -> bytes:
    """Build the 21-byte v3 header: [salt][version][record_size BE]."""
    return salt + bytes([SCHEME_VERSION]) + struct.pack(">I", RECORD_SIZE)


def parse_header(ciphertext: bytes) -> tuple[bytes, int, int]:
    """Parse the v3 header. Returns (salt, version, record_size)."""
    salt = ciphertext[:SALT_LENGTH]
    version = ciphertext[SALT_LENGTH]
    record_size = struct.unpack(
        ">I",
        ciphertext[
            SALT_LENGTH + VERSION_LENGTH : SALT_LENGTH + VERSION_LENGTH + RECORD_SIZE_FIELD_LENGTH
        ],
    )[0]
    return salt, version, record_size


def ece_encrypt(plaintext: bytes, file_key: bytes, salt: bytes) -> bytes:
    """Encrypt plaintext using AES-256-GCM ECE.

    The salt must be the same one used for key derivation; it travels in the
    header so the receiver can re-derive the key.
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
    """Decrypt ECE ciphertext into plaintext bytes."""
    if len(ciphertext) < HEADER_LENGTH:
        raise CryptoError("Ciphertext too short")

    _salt, version, record_size = parse_header(ciphertext)
    if version != SCHEME_VERSION:
        raise CryptoError(
            f"Unsupported encryption version: {version} (expected {SCHEME_VERSION})"
        )

    nonce_base = compute_nonce_base(file_key)
    aesgcm = AESGCM(file_key)
    ct_record_size = record_size + TAG_LENGTH

    plaintext = bytearray()
    offset = HEADER_LENGTH
    seq = 0
    while offset < len(ciphertext):
        remaining = len(ciphertext) - offset
        chunk = (
            ciphertext[offset : offset + ct_record_size]
            if remaining >= ct_record_size
            else ciphertext[offset:]
        )
        nonce = record_nonce(nonce_base, seq)
        try:
            plaintext.extend(aesgcm.decrypt(nonce, chunk, None))
        except Exception as exc:
            raise CryptoError(
                f"Decryption failed at record {seq} (wrong password or corrupted data)"
            ) from exc
        offset += len(chunk)
        seq += 1

    return bytes(plaintext)


def files_to_7z(files: list[tuple[str, bytes]]) -> bytes:
    """Compress files into a 7z archive (mirrors JS7z in the frontend)."""
    import io

    import py7zr

    buf = io.BytesIO()
    with py7zr.SevenZipFile(buf, "w") as archive:
        for name, data in files:
            archive.writestr(data, name)
    return buf.getvalue()


def extract_7z(archive_bytes: bytes) -> list[tuple[str, bytes]]:
    """Decompress a 7z archive back into (name, data) tuples."""
    import io
    import os
    import tempfile

    import py7zr

    with tempfile.TemporaryDirectory() as tmpdir:
        with py7zr.SevenZipFile(io.BytesIO(archive_bytes), "r") as archive:
            archive.extractall(tmpdir)
        files: list[tuple[str, bytes]] = []
        for root, _dirs, filenames in os.walk(tmpdir):
            for filename in filenames:
                abs_path = os.path.join(root, filename)
                rel_path = os.path.relpath(abs_path, tmpdir).replace(os.sep, "/")
                files.append((rel_path, open(abs_path, "rb").read()))
    return files


async def encrypt_files(
    files: list[tuple[str, bytes]],
    *,
    password: str = "",
    secret_key: bytes | None = None,
) -> EncryptedBundle:
    """Compress and encrypt files into an encrypted bundle.

    Pipeline:
      1. Files are compressed into a 7z archive
      2. Archive is encrypted with AES-256-GCM ECE (64 KiB records)
      3. Wire format: [16B salt][1B version=3][4B record_size][records...]
    """
    if not files:
        raise ValidationError("At least one file is required")

    salt = os.urandom(SALT_LENGTH)
    ikm = await resolve_ikm(password or None, secret_key, salt)
    file_key = derive_file_key(ikm, salt)
    archive_bytes = await anyio.to_thread.run_sync(files_to_7z, files)
    ciphertext = ece_encrypt(archive_bytes, file_key, salt)

    return EncryptedBundle(ciphertext)


async def decrypt_bundle(
    bundle: EncryptedBundle | bytes,
    *,
    password: str = "",
    secret_key: bytes | None = None,
) -> list[tuple[str, bytes]]:
    """Decrypt and decompress an encrypted bundle into (name, data) tuples."""
    raw = bundle.raw if isinstance(bundle, EncryptedBundle) else bytes(bundle)

    if len(raw) < HEADER_LENGTH:
        raise CryptoError("Ciphertext too short")

    salt, version, _record_size = parse_header(raw)
    if version != SCHEME_VERSION:
        raise CryptoError(
            f"Unsupported encryption version: {version} (expected {SCHEME_VERSION})"
        )

    ikm = await resolve_ikm(password or None, secret_key, salt)
    file_key = derive_file_key(ikm, salt)
    archive_bytes = ece_decrypt(raw, file_key)

    return await anyio.to_thread.run_sync(extract_7z, archive_bytes)


async def encrypt_data(
    data: bytes,
    *,
    password: str = "",
    secret_key: bytes | None = None,
) -> bytes:
    """Encrypt raw bytes (no compression) using the ECE wire format."""
    if not data:
        raise ValidationError("Data must not be empty")

    salt = os.urandom(SALT_LENGTH)
    ikm = await resolve_ikm(password or None, secret_key, salt)
    file_key = derive_file_key(ikm, salt)
    return ece_encrypt(data, file_key, salt)


async def decrypt_data(
    ciphertext: bytes,
    *,
    password: str = "",
    secret_key: bytes | None = None,
) -> bytes:
    """Decrypt raw ECE ciphertext (no decompression)."""
    if len(ciphertext) < HEADER_LENGTH:
        raise CryptoError("Ciphertext too short")

    salt, version, _record_size = parse_header(ciphertext)
    if version != SCHEME_VERSION:
        raise CryptoError(
            f"Unsupported encryption version: {version} (expected {SCHEME_VERSION})"
        )

    ikm = await resolve_ikm(password or None, secret_key, salt)
    file_key = derive_file_key(ikm, salt)
    return ece_decrypt(ciphertext, file_key)


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
    "files_to_7z",
    "extract_7z",
    "EncryptedBundle",
    "ValidationError",
    "CryptoError",
]
