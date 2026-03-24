from pathlib import Path
from typing import Annotated
import tempfile
import os
from rich.console import Console

import typer
from app import archive, client, crypto
from app.builder.urls import UrlBuilder
from app.helpers.file import cleanup
from app.helpers.print import print_compact_qr

app = typer.Typer(help="Upload & download encrypted files via Chithi.")
console = Console()


@app.command()
def upload(
    path: Annotated[Path, typer.Argument(exists=True, resolve_path=True)],
    instance_url: Annotated[str | None, typer.Option("--url", "-u")] = None,
    password: Annotated[str | None, typer.Option("--password", "-p")] = None,
    expire_downloads: Annotated[int | None, typer.Option("--downloads", "-d")] = None,
    expire_seconds: Annotated[int | None, typer.Option("--expire", "-e")] = None,
    filename: Annotated[str | None, typer.Option("--name", "-n")] = None,
    minimal: Annotated[
        bool, typer.Option("--minimal", "-m", help="Only output the download URL.")
    ] = False,
) -> None:
    """Compress, encrypt, and upload a file or folder."""
    try:
        # Resolve URLs based on input/prompts
        urls = UrlBuilder.resolve(instance_url)

        with client.Client(urls) as c:
            # Get server config for defaults
            config = c.get_config()
            expire_seconds = expire_seconds or config.get("default_expiry", 86400)
            expire_downloads = expire_downloads or config.get(
                "default_number_of_downloads", 1
            )

            # Setup temporary paths
            fd_zip, tmp_zip_str = tempfile.mkstemp(suffix=".zip", prefix="chithi_")
            os.close(fd_zip)
            fd_enc, tmp_enc_str = tempfile.mkstemp(suffix=".enc", prefix="chithi_")
            os.close(fd_enc)

            tmp_zip, tmp_enc = Path(tmp_zip_str), Path(tmp_enc_str)

            try:
                # Processing: Compress -> Encrypt -> Upload
                archive.compress(path, tmp_zip, password=password)
                ikm = crypto.generate_ikm()
                crypto.encrypt(tmp_zip, tmp_enc, ikm=ikm, password=password)
                key_secret = crypto.ikm_to_base64url(ikm)

                result = c.upload_file(
                    tmp_enc,
                    filename=filename or path.name,
                    expire_after_n_download=int(expire_downloads),
                    expire_after=int(expire_seconds),
                )

                # Extract identifier from response
                slug = result.get("key") or result.get("path") or result.get("id")
                if not slug:
                    raise ValueError(
                        "Server response did not include a file identifier."
                    )

                # Construct the link
                download_url = urls.share_url(slug, key_secret)

            finally:
                cleanup(tmp_zip, tmp_enc)

        # --- UI Output Logic ---
        if minimal:
            # Clean output for scripts or pipes
            typer.echo(download_url)
        else:
            # Pretty output
            typer.echo("\n✓ Upload complete!")
            print_compact_qr(download_url, console)
            typer.echo(f"\n  Download URL : {download_url}")
            if password:
                typer.echo(
                    "  ⚠ Password-protected. Recipients will need the password to decrypt."
                )

    except Exception as exc:
        typer.echo(f"✗ Upload failed: {exc}", err=True)
        raise typer.Exit(code=1)
