"""Type definitions for the Chithi SDK."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Tuple


@dataclass(frozen=True)
class EncryptedBundle:
    """An encrypted bundle produced by Chithi.upload().

    Contains the encrypted data along with all necessary crypto metadata
    (salt, initialization vector, signature) for decryption.

    Attributes:
        raw: Raw bundle bytes including crypto metadata and encrypted data.
    """
    raw: bytes

    def __len__(self) -> int:
        return len(self.raw)

    def __repr__(self) -> str:
        return f"EncryptedBundle(size={len(self.raw):,} bytes)"


FileEntry = Tuple[str, bytes]
"""A (filename, data) tuple representing a file."""
