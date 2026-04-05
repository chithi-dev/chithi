import typer

from app.cli.add_user import app as add_user_app
from app.cli.change_password import app as change_password_app
from app.cli.list_users import app as list_users_app

app = typer.Typer()

app.add_typer(add_user_app)
app.add_typer(change_password_app)
app.add_typer(list_users_app)


def main():
    app()
