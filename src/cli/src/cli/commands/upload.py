"""Upload command — compress, encrypt, and upload a file via GraphQL."""

from __future__ import annotations

import os
import tempfile
from pathlib import Path
from typing import Annotated

import async_typer as typer
from rich.console import Console

from cli.core.graphql_client import GraphQLClient
from cli.core.urls import resolve_graphql_url, share_url


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
    minimal: Annotated[bool, typer.Option("--minimal", "-m")] = False,
    no_qr: Annotated[bool, typer.Option("--no-qr")] = False,
) -> None:
    """Compress, encrypt, and upload a file or folder, then print the share link."""
    graphql_url = resolve_graphql_url(instance_url)

    # Import helpers from existing app/ structure (still available during migration)
    from app.helpers.archive import compress as do_compress  # noqa: F401
    from app.helpers.crypto import encrypt as do_encrypt, generate_ikm, ikm_to_base64url  # noqa: F401
    from app.helpers.file import cleanup as do_cleanup

    try:
        fd_zip, tmp_zip_str = tempfile.mkstemp(suffix=".zip", prefix="chithi_")
        os.close(fd_zip)
        fd_enc, tmp_enc_str = tempfile.mkstemp(suffix=".enc", prefix="chithi_")
        os.close(fd_enc)

        tmp_zip, tmp_enc = Path(tmp_zip_str), Path(tmp_enc_str)

        try:
            do_compress(path, tmp_zip, password=password)
            ikm = generate_ikm()
            do_encrypt(tmp_zip, tmp_enc, ikm=ikm, password=password)
            key_secret = ikm_to_base64url(ikm)

            display_name = filename or path.name
            file_size = tmp_enc.stat().st_size

            with tqdm(total=file_size, unit="B", unit_scale=True, desc="Uploading", leave=False) as pbar:
                class _ProgressReader:  # noqa: F811
                    def __init__(self, fp: BinaryIO, bar: tqdm) -> None:
                        self._fp = fp
                        self._bar = bar

                    def read(self, size: int = -1) -> bytes:
                        data = self._fp.read(size)
                        if data:
                            self._bar.update(len(data))
                        return data

                with open(tmp_enc, "rb") as f:
                    wrapped = cast(BinaryIO, _ProgressReader(f, pbar))

                    async with GraphQLClient(graphql_url) as client:
                        result = await client.upload_file(
                            tmp_enc,
                            filename=display_name,
                            expire_after_n_download=expire_downloads,
                            expire_after=expire_seconds,
                        )

            slug_value = result.get("key") or result.get("path") or result.get("id")
            slug = str(slug_value) if slug_value is not None else None
            if not slug:
                raise ValueError("Server response did not include a file identifier.")

            dl_url = share_url(slug, key_secret)

        finally:
            do_cleanup(tmp_zip, tmp_enc)

        # Output
        if minimal:
            console.print(dl_url, highlight=False, markup=False)
        else:
            console.print("\n[green]✓ Upload complete![/green]")
            if not no_qr and "print_compact_qr" in globals():
                from app.helpers.print import print_compact_qr as do_print_qr  # noqa: F401
                do_print_qr(dl_url, console)
            console.print(f"\n  Download URL : {dl_url}")
            if password:
                console.print(
                    "  [yellow]⚠ Password-protected. Recipients will need the password to decrypt.[/yellow]"
                )

    except Exception as exc:
        error_console.print(f"[red]✗ Upload failed: {exc}[/red]")
        raise typer.Exit(code=1)


from io import BinaryIO  # noqa: E402
from tqdm import tqdm  # noqa: E402
from typing import cast  # noqa: E402
