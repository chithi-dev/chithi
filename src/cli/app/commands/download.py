import tempfile
from pathlib import Path
from typing import Annotated
from urllib.parse import urlparse

import async_typer as typer
from rich.console import Console

from app import client
from app.builder.urls import UrlBuilder
from app.helpers.archive import decrypt_and_decompress

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
        if not password:
            password = typer.prompt("Enter decryption password", hide_input=True)
            if not password:
                error_console.print("[red]Password must not be empty.[/red]")
                raise typer.Exit(code=1)

        slug = ""
        inferred_url: str | None = None

        # Parse the input link
        if "://" in link:
            parsed = urlparse(link)
            path_parts = [p for p in parsed.path.split("/") if p]
            if not path_parts:
                raise ValueError(
                    "Link must be in format: https://domain/download/SLUG#KEY"
                )
            slug = path_parts[-1]
            inferred_url = f"{parsed.scheme}://{parsed.netloc}"
        elif "#" in link:
            slug, _ = link.split("#", 1)
        else:
            # Plain slug
            slug = link

        urls = UrlBuilder.resolve(initial_url=(instance_url or inferred_url))

        # Use a TemporaryDirectory for thread-safe, secure file handling
        with tempfile.TemporaryDirectory(prefix="chithi_") as tmp_dir:
            tmp_path = Path(tmp_dir)
            tmp_dl = tmp_path / "encrypted.bin"

            # Download encrypted bundle
            async with client.Client(urls) as c:
                await c.download_to_file(slug, tmp_dl)

            # Read bundle data
            bundle_data = tmp_dl.read_bytes()

            # Decrypt and decompress using SDK (parallel across all cores)
            out_path = output.resolve()
            decrypt_and_decompress(bundle_data, out_path, password=password)

            console.print(f"\n[green]Success! Extracted to {out_path}[/green]")

    except Exception as exc:
        error_console.print(f"[red]Download failed: {exc}[/red]")
        raise typer.Exit(1)
