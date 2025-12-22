from pydantic import BaseModel


class ConfigIn(BaseModel):
    # Storage constraints
    total_storage_limit_gb: int
    max_file_size_mb: int

    # Default constraints
    default_expiry_days: int
    default_number_of_downloads: int

    # Markdown
    site_description: str
