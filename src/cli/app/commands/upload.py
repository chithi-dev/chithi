from pathlib import Path
from typing import Annotated
import io
import tempfile
import os
from rich.console import Console

import resvg_py
import segno
import typer
from app import archive, client, crypto
from app.builder.urls import UrlBuilder
from app.helpers.file import cleanup
from rich_pixels import Pixels
from PIL import Image

app = typer.Typer(help="Upload & download encrypted files via Chithi.")
console = Console()

_LOGO_SVG = Path(__file__).parent.parent / "data" / "logo.svg"


@app.command()
def upload(
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

        with client.Client(urls) as c:
            # Fetch config
            config = c.get_config()
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

                result = c.upload_file(
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

        # Build QR + logo as AVIF, then render to terminal
        fd_qr, tmp_qr_str = tempfile.mkstemp(suffix=".avif", prefix="chithi_qr_")
        os.close(fd_qr)
        tmp_qr = Path(tmp_qr_str)
        try:
            _make_qr_avif(download_url, tmp_qr)
            pixels = Pixels.from_image_path(str(tmp_qr))
        finally:
            tmp_qr.unlink(missing_ok=True)

        typer.echo("✓ Upload complete!")
        console.print(pixels)
        typer.echo(f"  Download URL : {download_url}")

        if password:
            typer.echo(
                "  ⚠ File is password-protected – the same password is required to decrypt."
            )

    except Exception as exc:
        typer.echo(f"✗ Upload failed: {exc}", err=True)
        raise typer.Exit(code=1)


def _make_qr_avif(url: str, dest: Path) -> None:
    """Generate a QR code for *url*, overlay logo.svg in the center, save as AVIF."""
    # Render QR to an in-memory PNG (scale=10 → ~10px per module)
    qr = segno.make(url, error="H")
    buf = io.BytesIO()
    qr.save(buf, kind="png", scale=10)
    buf.seek(0)
    qr_img = Image.open(buf).convert("RGBA")

    # Overlay the SVG logo if available
    if _LOGO_SVG.exists():
        logo_size = qr_img.width // 4
        svg_bytes = resvg_py.svg_to_bytes(
            svg_path=str(_LOGO_SVG),
            width=logo_size,
            height=logo_size,
        )
        logo = Image.open(io.BytesIO(svg_bytes)).convert("RGBA")
        pos = ((qr_img.width - logo_size) // 2, (qr_img.height - logo_size) // 2)
        qr_img.paste(logo, pos, logo)

    # Save as AVIF
    qr_img.convert("RGB").save(str(dest), format="AVIF")
