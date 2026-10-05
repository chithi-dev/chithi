"""Pydantic schemas for the file info and chunk URL endpoints."""

from ninja import Schema


class FileInfoResponse(Schema):
    id: str
    key: str
    filename: str
    size: int
    number_of_files: int | None
    download_count: int
    created_at: str
    expires_at: str
    expire_after_n_download: int
    is_expired: bool
    chunk_count: int


class ChunkUrlResponse(Schema):
    url: str
