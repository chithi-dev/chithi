"""Tests for the v3 encryption scheme (mirrors the frontend's encryption.client.test.ts)."""

import os
import struct

import pytest

from app.helpers.crypto import (
    SCHEME_VERSION,
    RECORD_SIZE,
    SALT_LENGTH,
    HEADER_LENGTH,
    password_to_ikm,
    derive_file_key,
    compute_nonce_base,
    record_nonce,
    encrypt_data,
    decrypt_data,
    encrypt_files,
    decrypt_bundle,
)
from app.chithi_exceptions import CryptoError, ValidationError


def test_password_to_ikm_is_32_bytes_and_deterministic():
    salt = os.urandom(16)
    ikm_a = password_to_ikm("correct horse battery staple", salt)
    ikm_b = password_to_ikm("correct horse battery staple", salt)
    assert len(ikm_a) == 32
    assert ikm_a == ikm_b


def test_password_to_ikm_is_salt_sensitive():
    ikm_a = password_to_ikm("same-password", os.urandom(16))
    ikm_b = password_to_ikm("same-password", os.urandom(16))
    assert ikm_a != ikm_b


def test_derive_file_key_is_32_bytes_aead256():
    ikm = os.urandom(32)
    salt = os.urandom(16)
    file_key_a = derive_file_key(ikm, salt)
    file_key_b = derive_file_key(ikm, salt)
    assert len(file_key_a) == 32
    assert file_key_a == file_key_b


def test_derive_file_key_is_salt_sensitive():
    ikm = os.urandom(32)
    assert derive_file_key(ikm, os.urandom(16)) != derive_file_key(ikm, os.urandom(16))


def test_nonce_base_is_12_bytes_and_deterministic():
    file_key = os.urandom(32)
    assert compute_nonce_base(file_key) == compute_nonce_base(file_key)
    assert len(compute_nonce_base(file_key)) == 12


def test_record_nonce_is_deterministic_and_distinct_per_seq():
    nonce_base = os.urandom(12)
    assert record_nonce(nonce_base, 0) == record_nonce(nonce_base, 0)
    assert record_nonce(nonce_base, 0) != record_nonce(nonce_base, 1)
    assert len(record_nonce(nonce_base, 0)) == 12


def test_header_format_v3():
    ct = encrypt_data(b"x" * 100, password="pw")
    version = ct[SALT_LENGTH]
    record_size = struct.unpack(">I", ct[SALT_LENGTH + 1 : SALT_LENGTH + 5])[0]
    assert version == SCHEME_VERSION
    assert record_size == RECORD_SIZE
    assert HEADER_LENGTH == 21


def test_encrypt_decrypt_data_roundtrip_password():
    plaintext = os.urandom(RECORD_SIZE * 2 + 1234)
    ct = encrypt_data(plaintext, password="pw")
    assert decrypt_data(ct, password="pw") == plaintext


def test_encrypt_decrypt_data_roundtrip_secret_key():
    plaintext = os.urandom(1000)
    secret = os.urandom(32)
    ct = encrypt_data(plaintext, secret_key=secret)
    assert decrypt_data(ct, secret_key=secret) == plaintext


def test_encrypt_files_decrypt_bundle_roundtrip():
    files = [("a.txt", b"alpha"), ("b.txt", b"bravo" * 5000), ("c/d/e.txt", b"charlie")]
    bundle = encrypt_files(files, password="pw")
    assert sorted(decrypt_bundle(bundle, password="pw")) == sorted(files)


def test_wrong_password_is_rejected():
    ct = encrypt_data(b"secret data", password="correct")
    with pytest.raises(CryptoError):
        decrypt_data(ct, password="wrong")


def test_empty_files_raises():
    with pytest.raises(ValidationError):
        encrypt_files([], password="pw")


def test_empty_data_raises():
    with pytest.raises(ValidationError):
        encrypt_data(b"", password="pw")


def test_ciphertext_too_short_raises():
    with pytest.raises(CryptoError):
        decrypt_data(b"too-short", password="pw")
