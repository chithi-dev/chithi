"""Chithi-compatible encryption core."""

import base64
import hashlib
import os
import struct
from pathlib import Path
from typing import Tuple

from app.constants.crypto import (
    CHUNK_SIZE,
    ENC_CHUNK_SIZE,
    HKDF_IV_STR,
    HKDF_SALT_STR,
    AES_KEY_STR,
)

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.argon2 import Argon2id
from tqdm import tqdm


def generate_ikm() -> bytes:
    """Generate a random 32-byte IKM."""
    return os.urandom(32)


def ikm_to_base64url(ikm: bytes) -> str:
    return base64.urlsafe_b64encode(ikm).rstrip(b"=").decode("ascii")


def base64url_to_ikm(s: str) -> bytes:
    s += "=" * (-len(s) % 4)
    return base64.urlsafe_b64decode(s)


def encrypt(src: Path, dst: Path, ikm: bytes, password: str | None = None) -> Path:
    """Encrypt file using AES-256-GCM streaming."""
    aes_key, base_iv = _derive_secrets(ikm, password)
    aes = AESGCM(aes_key)

    file_size = src.stat().st_size
    chunk_idx = 0

    with (
        open(src, "rb") as fin,
        open(dst, "wb") as fout,
        tqdm(
            total=file_size,
            unit="B",
            unit_scale=True,
            desc="Encrypting",
            leave=False,
        ) as pbar,
    ):
        while True:
            block = fin.read(CHUNK_SIZE)
            if not block:
                break

            iv = _get_chunk_iv(base_iv, chunk_idx)
            ct = aes.encrypt(iv, block, None)
            fout.write(ct)

            chunk_idx += 1
            pbar.update(len(block))

    return dst


def decrypt(src: Path, dst: Path, ikm: bytes, password: str | None = None) -> Path:
    """Decrypt file using AES-256-GCM streaming."""
    aes_key, base_iv = _derive_secrets(ikm, password)
    aes = AESGCM(aes_key)

    file_size = src.stat().st_size
    chunk_idx = 0

    with (
        open(src, "rb") as fin,
        open(dst, "wb") as fout,
        tqdm(
            total=file_size,
            unit="B",
            unit_scale=True,
            desc="Decrypting",
            leave=False,
        ) as pbar,
    ):
        while True:
            ct = fin.read(ENC_CHUNK_SIZE)
            if not ct:
                break

            iv = _get_chunk_iv(base_iv, chunk_idx)
            pt = aes.decrypt(iv, ct, None)
            fout.write(pt)

            chunk_idx += 1
            pbar.update(len(ct))

    return dst


def _derive_secrets(ikm: bytes, password: str | None) -> Tuple[bytes, bytes]:
    """Derive AES key and IV from IKM + Password."""
    # Salt
    derived_salt = hashlib.sha256(ikm + HKDF_SALT_STR).digest()

    # Mix Password
    final_ikm = ikm
    if password:
        salt_bytes = derived_salt[:16]
        pb = _argon2(
            password.encode(),
            salt_bytes,
            iterations=32,
            memory=16_384,
        )
        # XOR
        length = max(len(ikm), len(pb))
        a = ikm.ljust(length, b"\x00")
        b = pb.ljust(length, b"\x00")
        final_ikm = bytes(x ^ y for x, y in zip(a, b))

    # HKDF Salt & Base IV
    hkdf_salt = hashlib.sha256(final_ikm + AES_KEY_STR).digest()[:16]
    base_iv = hashlib.sha256(final_ikm + HKDF_IV_STR).digest()[:12]

    #  AES Key
    aes_key = _argon2(
        final_ikm,
        hkdf_salt,
        iterations=8,
        memory=64 * 1024,
    )

    return aes_key, base_iv


def _argon2(password: bytes, salt: bytes, iterations: int, memory: int) -> bytes:
    kdf = Argon2id(
        salt=salt,
        length=32,
        iterations=iterations,
        lanes=1,
        memory_cost=memory,
    )
    return kdf.derive(password)


def _get_chunk_iv(base_iv: bytes, index: int) -> bytes:
    iv = bytearray(base_iv)
    existing = struct.unpack_from("!I", iv, 8)[0]
    struct.pack_into("!I", iv, 8, existing ^ index)
    return bytes(iv)
