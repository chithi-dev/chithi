from pathlib import Path
from typing import Annotated
from urllib.parse import urlparse
import tempfile
import os
import typer

from app import archive, client, crypto
from app.builder.urls import UrlBuilder
from app.helpers.file import cleanup

app = typer.Typer(help="Upload & download encrypted files via Chithi.")


@app.command()
def download(
    link: Annotated[str, typer.Argument(help="Chithi share URL or 'slug#key'")],
    instance_url: Annotated[str | None, typer.Option("--url", "-u")] = None,
    password: Annotated[str | None, typer.Option("--password", "-p")] = None,
    output: Annotated[Path, typer.Option("--output", "-o")] = Path("."),
) -> None:
    """Download, decrypt, and extract a file."""
    try:
        slug: str
        key_secret: str
        inferred_url: str | None = None

        # Case A: Full URL provided
        if "://" in link:
            parsed = urlparse(link)
            key_secret = parsed.fragment
            path_parts = parsed.path.strip("/").split("/")

            if len(path_parts) >= 1:
                slug = path_parts[-1]
            else:
                raise ValueError("Could not extract slug from URL.")

            # Reconstruct the base (e.g., https://chithi.dev)
            inferred_url = f"{parsed.scheme}://{parsed.netloc}"

        # Case B: Just SLUG#KEY provided
        elif "#" in link:
            slug, key_secret = link.split("#", 1)
        else:
            raise ValueError("Invalid format. Use URL or SLUG#KEY")

    except ValueError as e:
        typer.echo(f"✗ Input parsing failed: {e}", err=True)
        raise typer.Exit(1)

    # Resolve URLs: Priority is --url option > Link metadata > Interactive Prompt
    urls = UrlBuilder.resolve(initial_url=(instance_url or inferred_url))

    # Process Download
    fd, tmp_run = tempfile.mkstemp(prefix="chithi_")
    os.close(fd)
    tmp_dl = Path(f"{tmp_run}.dl")
    tmp_zip = Path(f"{tmp_run}.zip")

    try:
        with client.Client(urls) as c:
            c.download_to_file(slug, tmp_dl)

        ikm = crypto.base64url_to_ikm(key_secret)
        crypto.decrypt(tmp_dl, tmp_zip, ikm=ikm, password=password)

        out_path = output.resolve()
        archive.decompress(tmp_zip, out_path, password=password)
        typer.echo(f"\n✓ Success! Extracted to {out_path}")

    except Exception as exc:
        typer.echo(f"✗ Download failed: {exc}", err=True)
        raise typer.Exit(1)
    finally:
        cleanup(tmp_dl, tmp_zip)
