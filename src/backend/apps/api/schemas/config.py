"""Pydantic schemas for the instance config endpoint."""

from ninja import Schema


class ConfigResponse(Schema):
    allow_uploads: bool
    max_file_size_limit: int
    default_expiry: int
    default_number_of_downloads: int
    site_description: str | None = None
