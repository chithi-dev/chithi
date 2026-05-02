from typing import Optional
from sqlmodel import Field, SQLModel


class InformationOut(SQLModel):
    python_version: str
    fastapi_version: str
    redis_version: str
    postgres_version: str
    version: str
    commit: str
    is_release: bool


class InstanceStatisticsOut(SQLModel):
    total_bytes: int = Field(description="Total size of all stored files in bytes")
    total_files: int = Field(description="Total number of files stored")
    total_downloads: int = Field(description="Total number of downloads across all files")
    active_urls: int = Field(description="Number of currently active URLs")
    active_rooms: int = Field(description="Number of currently active reverse rooms")
    links_with_download_caps: int = Field(
        description="Total number of links with download limits"
    )
    expiring_soon: int = Field(
        description="Number of URLs expiring within the next 24 hours"
    )
    latest_expiry: Optional[int] = Field(
        default=None,
        description="Unix timestamp of the latest expiry among active URLs",
    )
