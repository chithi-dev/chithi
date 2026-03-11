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
    link: Annotated[
        str,
        typer.Argument(
            help="Chithi share URL (https://…/download/<slug>#<key>) or '<slug>#<key>'.",
        ),
    ],
    instance_url: Annotated[
        str | None,
        typer.Option("--url", "-u", help="Chithi backend URL."),
    ] = None,
    password: Annotated[
        str | None,
        typer.Option(
            "--password",
            "-p",
            help="Decryption password (required if the file was password-protected).",
            prompt=False,
        ),
    ] = None,
    output: Annotated[
        Path,
        typer.Option(
            "--output", "-o", help="Destination directory for extracted files."
        ),
    ] = Path("."),
) -> None:
    """Download, decrypt, and extract a file."""
    # Parse Input
    try:
        slug: str
        key_secret: str
        inferred_url: str | None = None

        #  Full URL -> https://instance.com/download/SLUG#KEY
        if "://" in link:
            parsed = urlparse(link)
            fragment = parsed.fragment
            path_parts = parsed.path.strip("/").split("/")

            # Expecting path ending in /download/SLUG
            if len(path_parts) >= 2 and path_parts[-2] == "download":
                slug = path_parts[-1]
            elif len(path_parts) >= 1:
                slug = path_parts[-1]
            else:
                raise ValueError("Could not extract slug from URL.")

            # Reconstruct base URL (everything before /download/...)
            inferred_url = f"{parsed.scheme}://{parsed.netloc}"
            key_secret = fragment

        #  SLUG#KEY
        elif "#" in link:
            slug, key_secret = link.split("#", 1)

        else:
            raise ValueError("Invalid link format. Expected URL or SLUG#KEY")

    except ValueError as e:
        typer.echo(f"✗ Input parsing failed: {e}", err=True)
        raise typer.Exit(code=1)

    base_url = instance_url or inferred_url
    urls = UrlBuilder.resolve(base_url)

    # Process
    fd, tmp_run = tempfile.mkstemp(prefix="chithi_")
    os.close(fd)

    tmp_dl = Path(f"{tmp_run}.dl")
    tmp_zip = Path(f"{tmp_run}.zip")

    try:
        # Download
        with client.Client(urls) as c:
            c.download_to_file(slug, tmp_dl)

        # Decrypt
        ikm = crypto.base64url_to_ikm(key_secret)
        crypto.decrypt(tmp_dl, tmp_zip, ikm=ikm, password=password)

        # Extract
        out_path = output.resolve()
        archive.decompress(tmp_zip, out_path, password=password)

        typer.echo(f"\n✓ Download complete! Files extracted to {out_path}")

    except Exception as exc:
        typer.echo(f"✗ Download failed: {exc}", err=True)
        raise typer.Exit(code=1)

    finally:
        cleanup(tmp_dl, tmp_zip)
