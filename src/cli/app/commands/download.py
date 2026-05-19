import tempfile
from pathlib import Path
from typing import Annotated
from urllib.parse import urlparse

import async_typer as typer
from rich.console import Console

from app import client
from app.builder.urls import UrlBuilder
from app.helpers.archive import decompress
from app.helpers.crypto import base64url_to_ikm, decrypt

app = typer.AsyncTyper(help="Download encrypted files via Chithi.")
console: Console = Console()
error_console: Console = Console(stderr=True)


@app.async_command()
async def download(
    link: Annotated[str, typer.Argument(help="URL or 'slug#key'")],
    instance_url: Annotated[str | None, typer.Option("--url", "-u")] = None,
    password: Annotated[str | None, typer.Option("--password", "-p")] = None,
    output: Annotated[Path, typer.Option("--output", "-o")] = Path("."),
) -> None:
    """Download a file from the public instance."""
    try:
        slug = ""
        key_secret = ""
        inferred_url: str | None = None

        # Parse the input link
        if "://" in link:
            parsed = urlparse(link)
            key_secret = parsed.fragment
            path_parts = [p for p in parsed.path.split("/") if p]
            if not key_secret or not path_parts:
                raise ValueError(
                    "Link must be in format: https://domain/download/SLUG#KEY"
                )
            slug = path_parts[-1]
            inferred_url = f"{parsed.scheme}://{parsed.netloc}"
        elif "#" in link:
            slug, key_secret = link.split("#", 1)
        else:
            raise ValueError("Invalid format. Use URL or SLUG#KEY")

        urls = UrlBuilder.resolve(initial_url=(instance_url or inferred_url))

        # Use a TemporaryDirectory for thread-safe, secure file handling
        with tempfile.TemporaryDirectory(prefix="chithi_") as tmp_dir:
            tmp_path = Path(tmp_dir)
            tmp_dl = tmp_path / "encrypted.bin"
            tmp_zip = tmp_path / "decrypted.zip"

            # Download
            async with client.Client(urls) as c:
                await c.download_to_file(slug, tmp_dl)

            # Decrypt
            ikm = base64url_to_ikm(key_secret)
            decrypt(tmp_dl, tmp_zip, ikm=ikm, password=password)

            #  Decompress
            out_path = output.resolve()
            decompress(tmp_zip, out_path, password=password)

            console.print(f"\n[green]✓ Success! Extracted to {out_path}[/green]")

    except Exception as exc:
        error_console.print(f"[red]✗ Download failed: {exc}[/red]")
        raise typer.Exit(1)
