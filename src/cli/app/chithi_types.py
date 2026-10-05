"""Type definitions for the Chithi CLI."""

from dataclasses import dataclass


@dataclass(frozen=True)
class EncryptedBundle:
    """An encrypted bundle produced by compress_and_encrypt.

    Contains the encrypted data along with all necessary crypto metadata
    (salt, version, record size, and AES-GCM records) for decryption.
    """

    raw: bytes

    def __len__(self) -> int:
        return len(self.raw)

    def __repr__(self) -> str:
        return f"EncryptedBundle(size={len(self.raw):,} bytes)"
