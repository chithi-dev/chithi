"""Download command — fetch and decrypt a file via GraphQL streaming."""

from __future__ import annotations

import os
import tempfile
from pathlib import Path
from typing import Annotated

import async_typer as typer
from rich.console import Console

from cli.core.graphql_client import GraphQLClient
from cli.core.urls import resolve_graphql_url


app: typer.AsyncTyper = typer.AsyncTyper(help="Download encrypted files via Chithi.")
console: Console = Console()
error_console: Console = Console(stderr=True)


@app.async_command()
async def download(
    url: Annotated[str, typer.Argument()],
    instance_url: Annotated[str | None, typer.Option("--url", "-u")] = None,
    password: Annotated[str | None, typer.Option("--password", "-p")] = None,
    output: Annotated[Path | None, typer.Option("--output", "-o", dir_okay=False)] = None,
) -> None:
    """Download and decrypt a file from Chithi. Accepts full URL or slug#key format."""
    graphql_url = resolve_graphql_url(instance_url)

    # Parse URL to extract slug and key
    if "#" in url:
        base_part, _, key_secret = url.partition("#")
        parts = base_part.rstrip("/").split("/")
        slug = parts[-1]  # last segment is the slug
    else:
        slug = url

    try:
        dest = output or Path(f"downloaded_{slug}")

        async with GraphQLClient(graphql_url) as client:
            await client.download_stream_to_file(slug, dest)

        # Decrypt if password provided
        if password:
            from app.helpers.crypto import decrypt  # noqa: F401

            decrypted = dest.with_suffix(dest.suffix + ".dec")
            ikm_bytes = _base64url_decode(key_secret)
            do_decrypt(str(dest), str(decrypted), ikm=ikm_bytes, password=password)  # type: ignore[name-defined]
            os.replace(str(decrypted), str(dest))

        console.print(f"[green]✓ Downloaded to {dest}[/green]")

    except Exception as exc:
        error_console.print(f"[red]✗ Download failed: {exc}[/red]")
        raise typer.Exit(code=1)


def _base64url_decode(s: str) -> bytes:
    """Decode base64url-encoded string (no padding)."""
    import base64

    s = s.replace("-", "+").replace("_", "/")
    padding = 4 - len(s) % 4
    if padding != 4:
        s += "=" * padding
    return base64.b64decode(s)
