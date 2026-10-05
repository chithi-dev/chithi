"""Tests for the v3 encryption scheme (mirrors the frontend's encryption.client.test.ts)."""

import os
import struct

import pytest

from app.chithi_exceptions import CryptoError, ValidationError
from app.helpers.crypto import (
    HEADER_LENGTH,
    RECORD_SIZE,
    SCHEME_VERSION,
    SALT_LENGTH,
    compute_nonce_base,
    decrypt_bundle,
    decrypt_data,
    derive_file_key,
    encrypt_data,
    encrypt_files,
    password_to_ikm,
    record_nonce,
)


async def test_password_to_ikm_is_32_bytes_and_deterministic() -> None:
    salt = os.urandom(16)
    ikm_a = await password_to_ikm("correct horse battery staple", salt)
    ikm_b = await password_to_ikm("correct horse battery staple", salt)
    assert len(ikm_a) == 32
    assert ikm_a == ikm_b


async def test_password_to_ikm_is_salt_sensitive() -> None:
    ikm_a = await password_to_ikm("same-password", os.urandom(16))
    ikm_b = await password_to_ikm("same-password", os.urandom(16))
    assert ikm_a != ikm_b


def test_derive_file_key_is_32_bytes_aead256() -> None:
    ikm = os.urandom(32)
    salt = os.urandom(16)
    file_key_a = derive_file_key(ikm, salt)
    file_key_b = derive_file_key(ikm, salt)
    assert len(file_key_a) == 32
    assert file_key_a == file_key_b


def test_derive_file_key_is_salt_sensitive() -> None:
    ikm = os.urandom(32)
    assert derive_file_key(ikm, os.urandom(16)) != derive_file_key(ikm, os.urandom(16))


def test_nonce_base_is_12_bytes_and_deterministic() -> None:
    file_key = os.urandom(32)
    assert compute_nonce_base(file_key) == compute_nonce_base(file_key)
    assert len(compute_nonce_base(file_key)) == 12


def test_record_nonce_is_deterministic_and_distinct_per_seq() -> None:
    nonce_base = os.urandom(12)
    assert record_nonce(nonce_base, 0) == record_nonce(nonce_base, 0)
    assert record_nonce(nonce_base, 0) != record_nonce(nonce_base, 1)
    assert len(record_nonce(nonce_base, 0)) == 12


async def test_header_format_v3() -> None:
    ct = await encrypt_data(b"x" * 100, password="pw")
    version = ct[SALT_LENGTH]
    record_size = struct.unpack(">I", ct[SALT_LENGTH + 1 : SALT_LENGTH + 5])[0]
    assert version == SCHEME_VERSION
    assert record_size == RECORD_SIZE
    assert HEADER_LENGTH == 21


async def test_encrypt_decrypt_data_roundtrip_password() -> None:
    plaintext = os.urandom(RECORD_SIZE * 2 + 1234)
    ct = await encrypt_data(plaintext, password="pw")
    assert await decrypt_data(ct, password="pw") == plaintext


async def test_encrypt_decrypt_data_roundtrip_secret_key() -> None:
    plaintext = os.urandom(1000)
    secret = os.urandom(32)
    ct = await encrypt_data(plaintext, secret_key=secret)
    assert await decrypt_data(ct, secret_key=secret) == plaintext


async def test_encrypt_files_decrypt_bundle_roundtrip() -> None:
    files = [("a.txt", b"alpha"), ("b.txt", b"bravo" * 5000), ("c/d/e.txt", b"charlie")]
    bundle = await encrypt_files(files, password="pw")
    assert sorted(await decrypt_bundle(bundle, password="pw")) == sorted(files)


async def test_wrong_password_is_rejected() -> None:
    ct = await encrypt_data(b"secret data", password="correct")
    with pytest.raises(CryptoError):
        await decrypt_data(ct, password="wrong")


async def test_empty_files_raises() -> None:
    with pytest.raises(ValidationError):
        await encrypt_files([], password="pw")


async def test_empty_data_raises() -> None:
    with pytest.raises(ValidationError):
        await encrypt_data(b"", password="pw")


async def test_ciphertext_too_short_raises() -> None:
    with pytest.raises(CryptoError):
        await decrypt_data(b"too-short", password="pw")
