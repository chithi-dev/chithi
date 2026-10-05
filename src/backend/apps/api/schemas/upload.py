"""Pydantic schemas for the chunked upload endpoints."""

from ninja import Schema


class RegisterRequest(Schema):
    filename: str
    total_size: int
    chunk_count: int
    expires_at: int
    expire_after_n_download: int
    number_of_files: int | None = None


class RegisterResponse(Schema):
    id: str
    key: str
    chunk_count: int
    chunk_size: int


class ChunkResponse(Schema):
    ok: bool
    chunk_index: int
    bytes: int


class CompleteResponse(Schema):
    ok: bool
    id: str
    key: str
