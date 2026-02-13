from urllib.parse import urljoin, urlparse

from app.settings import settings


class UrlBuilder:
    def __init__(self, instance_url: str):
        # Add https:// if scheme is missing
        parsed = urlparse(instance_url)
        if not parsed.scheme:
            instance_url = "https://" + instance_url

        self.__instance_url = instance_url.rstrip("/") + "/"

    @classmethod
    def resolve(cls, instance_url: str | None = None) -> "UrlBuilder":
        """Resolve instance URL from arg/env/prompt and return UrlBuilder."""
        import typer  # local import to avoid hard dep at module level

        url = instance_url or settings.INSTANCE_URL
        if not url:
            url = typer.prompt(
                "Enter the Chithi instance URL (e.g. https://chithi.dev)"
            )
        return cls(url)

    @property
    def instance_url(self):
        return self.__instance_url

    @property
    def __api_url(self):
        return urljoin(self.instance_url, "api/")

    def upload_url(self):
        # SENSITIVE URL
        return urljoin(self.__api_url, "upload")

    def config_url(self):
        return urljoin(self.__api_url, "config")

    def download_url(self):
        return urljoin(self.__api_url, "download/")

    def share_url(self, slug: str, key_secret: str) -> str:
        """Web-facing download link: ``https://instance/download/<slug>#<key>``."""
        return f"{self.instance_url}download/{slug}#{key_secret}"
