from urllib.parse import urljoin, urlparse

import async_typer as typer

from app.settings import settings


class UrlBuilder:
    """Builds backend and frontend URLs for the CLI."""

    def __init__(self, backend_url: str, frontend_url: str) -> None:
        """Create a URL builder from base backend and frontend URLs."""
        self._backend_url = self.__ensure_scheme(backend_url)
        self._frontend_url = self.__ensure_scheme(frontend_url)

    @staticmethod
    def __ensure_scheme(url: str) -> str:
        """Ensure the URL includes a scheme."""
        if not urlparse(url).scheme:
            return "https://" + url.lstrip("/")
        return url

    @staticmethod
    def __ensure_trailing_slash(url: str) -> str:
        """Ensure the URL ends with a trailing slash."""
        if not url.endswith("/"):
            return url + "/"
        return url

    @classmethod
    def resolve(cls, initial_url: str | None = None) -> "UrlBuilder":
        """Resolve URLs from input, settings, or interactive prompts."""
        url_candidate = initial_url or settings.INSTANCE_URL

        if url_candidate:
            base = cls.__ensure_scheme(url_candidate)
            # If "api" isn't in the URL, we assume the backend is at /api/
            if "/api" not in base.lower():
                base_dir = cls.__ensure_trailing_slash(base)
                return cls(backend_url=urljoin(base_dir, "api/"), frontend_url=base_dir)
            return cls(backend_url=base, frontend_url=base)

        # Interactive Fallback
        if typer.confirm("Are backend and frontend on the same domain?", default=True):
            domain = typer.prompt("Enter base domain", default="chithi.dev").strip("/")
            base = f"https://{domain}/"
            return cls(backend_url=urljoin(base, "api/"), frontend_url=base)
        else:
            frontend = typer.prompt("Frontend URL (e.g. https://chithi.dev)")
            backend = typer.prompt("Backend URL (e.g. https://api.chithi.dev)")
            return cls(backend_url=backend, frontend_url=frontend)

    @property
    def backend_url(self) -> str:
        """Return the normalized backend base URL."""
        return self.__ensure_trailing_slash(self._backend_url)

    @property
    def frontend_url(self) -> str:
        """Return the normalized frontend base URL."""
        return self.__ensure_trailing_slash(self._frontend_url)

    def upload_url(self) -> str:
        """Return the upload endpoint URL."""
        return urljoin(self.backend_url, "upload")

    def config_url(self) -> str:
        """Return the config endpoint URL."""
        return urljoin(self.backend_url, "config")

    def download_url(self) -> str:
        """Return the download endpoint base URL."""
        return urljoin(self.backend_url, "download/")

    def share_url(self, slug: str, key_secret: str) -> str:
        """Build a shareable frontend URL including the key fragment."""
        # urljoin handles the path joining
        base_share = urljoin(self.frontend_url, f"download/{slug}")
        return f"{base_share}#{key_secret}"
