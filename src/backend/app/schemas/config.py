from pydantic import BaseModel


class ConfigIn(BaseModel):
    # Storage constraints
    total_storage_limit_gb: int | None
    max_file_size_mb: int | None

    # Default constraints
    default_expiry: int | None
    default_number_of_downloads: int | None

    # Markdown
    site_description: str | None

    # Customizable fields
    download_configs: list[int] | None
    time_configs: list[str] | None

    # File type restrictions
    allowed_file_types: list[str] | None
    banned_file_types: list[str] | None
