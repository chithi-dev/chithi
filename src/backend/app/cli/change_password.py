import asyncio
from getpass import getpass

import typer
from sqlmodel import select

from app.db import AsyncSessionLocal
from app.models import User
from app.security import get_password_hash

app = typer.Typer()


async def update_user_password(username: str, password):
    async with AsyncSessionLocal() as session:
        result = await session.exec(select(User).where(User.username == username))
        found = result.first()
        if not found:
            typer.echo(f"User with {username} not found")
            raise typer.Exit(code=1)

        found.password_hash = password
        session.add(found)
        await session.commit()
        await session.refresh(found)
        typer.echo(f"User {username}'s password updated.")


@app.command()
def change_password(
    username: str = typer.Option(None, help="Username for the existing user"),
):
    if not username:
        username = typer.prompt("Username")
    password = getpass("Password: ")
    confirm_password = getpass("Confirm Password: ")

    if password != confirm_password:
        typer.echo("Passwords do not match!")
        raise typer.Exit(code=1)

    hashed_password = get_password_hash(password)
    asyncio.run(update_user_password(username, hashed_password))
