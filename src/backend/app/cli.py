import typer
import asyncio

from sqlmodel import select
from getpass import getpass

from app.db import AsyncSessionLocal
from app.models import User
from app.security import get_password_hash

cli = typer.Typer()


async def add_user_async(username: str, email: str | None, password_hash: str):
    async with AsyncSessionLocal() as session:
        # Check if user exists
        result = await session.exec(select(User).where(User.username == username))
        existing = result.first()
        if existing:
            typer.echo(f"User {username} already exists!")
            raise typer.Exit(code=1)

        user = User(username=username, email=email, password_hash=password_hash)
        session.add(user)
        await session.commit()
        await session.refresh(user)
        typer.echo(f"User {username} added with id {user.id}.")


@cli.command()
def add_user(
    email: str = typer.Option(None, help="Email for the new user"),
    username: str = typer.Option(None, help="Email for the new user"),
):
    if not username:
        username = typer.prompt("Username")

    password = getpass("Password: ")
    confirm_password = getpass("Confirm Password: ")
    if password != confirm_password:
        typer.echo("Passwords do not match!")
        raise typer.Exit(code=1)

    hashed_password = get_password_hash(password)
    asyncio.run(
        add_user_async(username=username, email=email, password_hash=hashed_password)
    )


def main():
    cli()
