from pathlib import Path
from typing import Annotated

import async_typer as typer
from rich.console import Console

from app import client
from app.builder.urls import UrlBuilder
from app.helpers.archive import compress_and_encrypt
from app.helpers.print import export_qr_svg, print_branded_qr

app = typer.Typer(help="Upload encrypted files via Chithi.")
console: Console = Console()
error_console: Console = Console(stderr=True)


@app.command()
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
    save_qr: Annotated[
        Path | None, typer.Option("--save-qr", help="Export QR code as SVG to this path.")
    ] = None,
) -> None:
    """Compress, encrypt, and upload a file or folder, then print the share link."""
    try:
        if not password:
            password = typer.prompt("Enter encryption password", hide_input=True)
            if not password:
                error_console.print("[red]Password must not be empty.[/red]")
                raise typer.Exit(code=1)

        urls = UrlBuilder.resolve(instance_url)

        async with client.Client(urls) as c:
            config = await c.get_config()
            if expire_seconds is None:
                expire_seconds = int(config.get("default_expiry") or 86400)
            if expire_downloads is None:
                expire_downloads = int(config.get("default_number_of_downloads") or 1)

            bundle = await compress_and_encrypt(path, password=password)

            result = await c.upload_file(
                bundle.raw,
                filename=filename or f"{path.name}.enc",
                expire_after_n_download=expire_downloads,
                expire_after=expire_seconds,
            )

            slug = result.get("key") or result.get("id")
            if not slug:
                raise ValueError("Server response did not include a file identifier")

            download_url = urls.share_url(str(slug), "")

        if minimal:
            console.print(download_url, highlight=False, markup=False)
        else:
            console.print("\n[green]Upload complete![/green]")
            if not no_qr:
                await print_branded_qr(download_url, console)
            console.print(f"\n  Download URL : {download_url}")
            console.print(
                "  [yellow]Password-protected. Recipients will need the password to decrypt.[/yellow]"
            )
            if save_qr:
                await export_qr_svg(download_url, str(save_qr))
                console.print(f"  [dim]QR code saved to {save_qr}[/dim]")

    except Exception as exc:
        error_console.print(f"[red]Upload failed: {exc}[/red]")
        raise typer.Exit(code=1)
