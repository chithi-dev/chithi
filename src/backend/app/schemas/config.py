from sqlmodel import SQLModel


class ConfigIn(SQLModel):
    # Storage constraints
    total_storage_limit: int | None = None
    max_file_size_limit: int | None = None

    # Default constraints
    default_expiry: int | None = None
    default_number_of_downloads: int | None = None

    # Markdown
    site_description: str | None = None

    # Customizable fields
    download_configs: list[int] | None = None
    time_configs: list[int] | None = None

    # File type restrictions
    allowed_file_types: list[str] | None = None
    banned_file_types: list[str] | None = None
