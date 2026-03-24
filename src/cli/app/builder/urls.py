from urllib.parse import urljoin, urlparse, urlunparse
from app.settings import settings
import typer


class UrlBuilder:
    def __init__(self, backend_url: str, frontend_url: str):
        # Ensure schemes are present
        self.__backend_url = self.__ensure_scheme(backend_url)
        self.__frontend_url = self.__ensure_scheme(frontend_url)

    @staticmethod
    def __ensure_scheme(url: str) -> str:
        if not urlparse(url).scheme:
            return "https://" + url.lstrip("/")
        return url

    @staticmethod
    def __ensure_trailing_slash(url: str) -> str:
        parsed = urlparse(url)
        if not parsed.path.endswith("/"):
            new_path = parsed.path + "/"
            parsed = parsed._replace(path=new_path)
        return urlunparse(parsed)

    @classmethod
    def resolve(cls, initial_url: str | None = None) -> "UrlBuilder":
        """
        Logic:
        1. If a URL is passed from CLI/Link, use it.
        2. If not, check settings.
        3. If still nothing, prompt user for 'Same Domain' setup.
        """
        url_candidate = initial_url or settings.INSTANCE_URL

        if url_candidate:
            # If we already have a URL, we treat it as both for simplicity
            return cls(backend_url=url_candidate, frontend_url=url_candidate)

        # Interactive Setup
        same_domain = typer.confirm(
            "Are the backend and frontend hosted on the same domain?", default=True
        )

        if same_domain:
            domain = typer.prompt("Enter the base domain", default="chithi.dev").strip(
                "/"
            )
            # Standard structure: root for frontend, /api/ for backend
            return cls(
                backend_url=f"https://{domain}/api/", frontend_url=f"https://{domain}/"
            )
        else:
            frontend = typer.prompt("Enter the Frontend URL (e.g. https://chithi.dev)")
            backend = typer.prompt(
                "Enter the Backend URL (e.g. https://api.chithi.dev)"
            )
            return cls(backend_url=backend, frontend_url=frontend)

    @property
    def instance_url(self):
        """Standardized backend base URL."""
        return self.__ensure_trailing_slash(self.__backend_url)

    @property
    def frontend_url(self):
        """Standardized frontend base URL."""
        return self.__ensure_trailing_slash(self.__frontend_url)

    def upload_url(self):
        return urljoin(self.instance_url, "upload")

    def config_url(self):
        return urljoin(self.instance_url, "config")

    def download_url(self):
        return urljoin(self.instance_url, "download/")

    def share_url(self, slug: str, key_secret: str) -> str:
        # Share URLs should point to the Frontend UI
        return f"{self.frontend_url}download/{slug}#{key_secret}"
