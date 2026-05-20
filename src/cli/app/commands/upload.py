import os
import tempfile
from pathlib import Path
from typing import Annotated, Any

import async_typer as typer
from rich.console import Console

from app import client
from app.builder.urls import UrlBuilder
from app.helpers.archive import compress
from app.helpers.crypto import encrypt, generate_ikm, ikm_to_base64url
from app.helpers.file import cleanup
from app.helpers.print import print_compact_qr

app: typer.AsyncTyper = typer.AsyncTyper(help="Upload encrypted files via Chithi.")
console: Console = Console()
error_console: Console = Console(stderr=True)


@app.async_command()
async def upload(
    path: Annotated[Path, typer.Argument(exists=True, resolve_path=True)],
    instance_url: Annotated[str | None, typer.Option("--url", "-u")] = None,
    password: Annotated[str | None, typer.Option("--password", "-p")] = None,
    expire_downloads: Annotated[int | None, typer.Option("--downloads", "-d")] = None,
    expire_seconds: Annotated[int | None, typer.Option("--expire", "-e")] = None,
    filename: Annotated[str | None, typer.Option("--name", "-n")] = None,
    minimal: Annotated[
        bool, typer.Option("--minimal", "-m", help="Only output the download URL.")
    ] = False,
    no_qr: Annotated[
        bool, typer.Option("--no-qr", help="Do not print the QR code.")
    ] = False,
) -> None:
    """Compress, encrypt, and upload a file or folder, then print the share link."""
    try:
        # Resolve URLs based on input/prompts
        urls = UrlBuilder.resolve(instance_url)

        async with client.Client(urls) as c:
            # Get server config for defaults
            config = await c.get_config()
            if expire_seconds is None:
                default_seconds = config.get("default_expiry", 86400)
                expire_seconds = (
                    int(default_seconds) if default_seconds is not None else 86400
                )
            if expire_downloads is None:
                default_downloads = config.get("default_number_of_downloads", 1)
                expire_downloads = (
                    int(default_downloads) if default_downloads is not None else 1
                )

            assert expire_seconds is not None
            assert expire_downloads is not None

            # Setup temporary paths
            fd_zip, tmp_zip_str = tempfile.mkstemp(suffix=".zip", prefix="chithi_")
            os.close(fd_zip)
            fd_enc, tmp_enc_str = tempfile.mkstemp(suffix=".enc", prefix="chithi_")
            os.close(fd_enc)

            tmp_zip, tmp_enc = Path(tmp_zip_str), Path(tmp_enc_str)

            try:
                # Processing: Compress -> Encrypt -> Upload
                compress(path, tmp_zip, password=password)
                ikm = generate_ikm()
                encrypt(tmp_zip, tmp_enc, ikm=ikm, password=password)
                key_secret = ikm_to_base64url(ikm)

                result: dict[str, Any] = await c.upload_file(
                    tmp_enc,
                    filename=filename or path.name,
                    expire_after_n_download=expire_downloads,
                    expire_after=expire_seconds,
                )

                # Extract identifier from response
                slug_value = result.get("key") or result.get("path") or result.get("id")
                slug = str(slug_value) if slug_value is not None else None
                if not slug:
                    raise ValueError(
                        "Server response did not include a file identifier."
                    )

                # Construct the link
                download_url = urls.share_url(slug, key_secret)

            finally:
                cleanup(tmp_zip, tmp_enc)

        # UI Output Logic
        if minimal:
            # Clean output for scripts or pipes
            console.print(download_url, highlight=False, markup=False)
        else:
            # Pretty output
            console.print("\n[green]✓ Upload complete![/green]")
            if not no_qr:
                print_compact_qr(download_url, console)
            console.print(f"\n  Download URL : {download_url}")
            if password:
                console.print(
                    "  [yellow]⚠ Password-protected. Recipients will need the password to decrypt.[/yellow]"
                )

    except Exception as exc:
        error_console.print(f"[red]✗ Upload failed: {exc}[/red]")
        raise typer.Exit(code=1)
