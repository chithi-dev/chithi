import typer

from app.cli.add_user import app as add_user_app
from app.cli.change_password import app as change_password_app

app = typer.Typer()

app.add_typer(add_user_app)
app.add_typer(change_password_app)


def main():
    app()
