from async_typer import AsyncTyper

from app.commands.download import app as download_app
from app.commands.upload import app as upload_app

app = AsyncTyper(help="Upload & download encrypted files via Chithi.")

app.add_typer(download_app)
app.add_typer(upload_app)

__all__ = ["app"]
