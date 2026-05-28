"""Chithi CLI — upload & download encrypted files via GraphQL."""

from __future__ import annotations

import sys

import async_typer as typer


app: typer.AsyncTyper = typer.AsyncTyper(
    help="Upload and download encrypted files via Chithi.",
)


# Register commands from submodules
try:
    from cli.commands.upload import app as upload_app  # noqa: F401

    app.add_typer(upload_app, name="upload")
except ImportError:
    pass

try:
    from cli.commands.download import app as download_app  # noqa: F401

    app.add_typer(download_app, name="download")
except ImportError:
    pass

try:
    from cli.commands.login import app as login_app  # noqa: F401

    app.add_typer(login_app, name="login")
except ImportError:
    pass


def main() -> None:
    """Entry point for the chithi CLI."""
    app()


if __name__ == "__main__":
    sys.exit(main())  # type: ignore[no-any-return]

