from pathlib import Path
from typing import Annotated
from urllib.parse import urlparse
import tempfile
import typer
from app import archive, client, crypto
from app.builder.urls import UrlBuilder

app = typer.Typer(help="Download encrypted files via Chithi.")


@app.command()
def download(
    link: Annotated[str, typer.Argument(help="URL or 'slug#key'")],
    instance_url: Annotated[str | None, typer.Option("--url", "-u")] = None,
    password: Annotated[str | None, typer.Option("--password", "-p")] = None,
    output: Annotated[Path, typer.Option("--output", "-o")] = Path("."),
):
    try:
        slug, key_secret, inferred_url = "", "", None

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
            with client.Client(urls) as c:
                c.download_to_file(slug, tmp_dl)

            # Decrypt
            ikm = crypto.base64url_to_ikm(key_secret)
            crypto.decrypt(tmp_dl, tmp_zip, ikm=ikm, password=password)

            #  Decompress
            out_path = output.resolve()
            archive.decompress(tmp_zip, out_path, password=password)

            typer.secho(f"\n✓ Success! Extracted to {out_path}", fg=typer.colors.GREEN)

    except Exception as exc:
        typer.secho(f"✗ Download failed: {exc}", fg=typer.colors.RED, err=True)
        raise typer.Exit(1)
    # No 'finally' block needed! TemporaryDirectory cleans itself up automatically.
