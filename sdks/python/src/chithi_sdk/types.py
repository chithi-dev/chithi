"""Data types for the Chithi SDK."""

from dataclasses import dataclass


@dataclass
class FileEntry:
    name: str
    data: bytes


@dataclass
class EncryptedBundle:
    bytes: bytes


@dataclass
class DownloadResult:
    files: list[FileEntry]
