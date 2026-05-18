import async_typer as typer

from app.commands.download import app as download_app
from app.commands.upload import app as upload_app

app: typer.AsyncTyper = typer.AsyncTyper(
    help="Upload & download encrypted files via Chithi."
)

app.add_typer(download_app)
app.add_typer(upload_app)

__all__: list[str] = ["app"]
