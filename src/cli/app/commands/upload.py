from pathlib import Path
from typing import Annotated
import tempfile
import os

import segno
import typer
from async_typer import AsyncTyper

from app import archive, client, crypto
from app.builder.urls import UrlBuilder
from app.helpers.file import cleanup

app = AsyncTyper(help="Upload & download encrypted files via Chithi.")


@app.async_command()
async def upload(
    path: Annotated[
        Path,
        typer.Argument(
            help="File or folder to upload.",
            exists=True,
            resolve_path=True,
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
            help="Add a password for extra protection. The recipient will need it to decrypt.",
            prompt=False,
        ),
    ] = None,
    expire_downloads: Annotated[
        int | None,
        typer.Option("--downloads", "-d", help="Expire after N downloads."),
    ] = None,
    expire_seconds: Annotated[
        int | None,
        typer.Option("--expire", "-e", help="Expire after N seconds."),
    ] = None,
    filename: Annotated[
        str | None,
        typer.Option("--name", "-n", help="Display name for the uploaded file."),
    ] = None,
) -> None:
    """Compress, encrypt, and upload a file or folder."""
    try:
        # Resolve the URL early (side effect: might prompt user)
        urls = UrlBuilder.resolve(instance_url)

        async with client.Client(urls) as c:
            # Fetch config
            config = await c.get_config()
            if expire_seconds is None:
                expire_seconds = config.get("default_expiry", 86400)

            # Validate expiry
            allowed_times = config.get("time_configs", [])
            if allowed_times and expire_seconds not in allowed_times:
                raise ValueError(
                    f"Expiry time {expire_seconds}s not supported. "
                    f"Allowed: {allowed_times}"
                )

            if expire_downloads is None:
                expire_downloads = config.get("default_number_of_downloads", 1)

            # Validate downloads
            allowed_downloads = config.get("download_configs", [])
            if allowed_downloads and expire_downloads not in allowed_downloads:
                raise ValueError(
                    f"Download limit {expire_downloads} not supported. "
                    f"Allowed: {allowed_downloads}"
                )

            # Prepare temporary paths
            fd_zip, tmp_zip_str = tempfile.mkstemp(suffix=".zip", prefix="chithi_")
            os.close(fd_zip)

            fd_enc, tmp_enc_str = tempfile.mkstemp(suffix=".enc", prefix="chithi_")
            os.close(fd_enc)

            tmp_zip = Path(tmp_zip_str)
            tmp_enc = Path(tmp_enc_str)

            try:
                # Compress
                archive.compress(path, tmp_zip, password=password)

                # Encrypt
                ikm = crypto.generate_ikm()
                crypto.encrypt(tmp_zip, tmp_enc, ikm=ikm, password=password)
                key_secret = crypto.ikm_to_base64url(ikm)

                # Upload
                display_name = filename or path.name

                # Ensure values are ints
                final_downloads = (
                    int(expire_downloads) if expire_downloads is not None else 1
                )
                final_expiry = (
                    int(expire_seconds) if expire_seconds is not None else 86400
                )

                result = await c.upload_file(
                    tmp_enc,
                    filename=display_name,
                    expire_after_n_download=final_downloads,
                    expire_after=final_expiry,
                )

                # Generate Link
                slug = result.get("key") or result.get("path") or result.get("id")
                if not slug:
                    raise ValueError(f"Server response missing file key: {result}")

                download_url = urls.share_url(slug, key_secret)

            finally:
                cleanup(tmp_zip, tmp_enc)

        qr = segno.make(download_url)

        typer.echo("\n✓ Upload complete!")
        typer.echo(qr.terminal(compact=True))
        typer.echo(f"  Download URL : {download_url}")

        if password:
            typer.echo(
                "  ⚠ File is password-protected – the same password is required to decrypt."
            )

    except Exception as exc:
        typer.echo(f"✗ Upload failed: {exc}", err=True)
        raise typer.Exit(code=1)
