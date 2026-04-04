from getpass import getpass

import asyncio
import typer
from sqlmodel import select

from app.vendor.async_typer import AsyncTyper
from app.db import AsyncSessionLocal
from app.models import User
from app.security import get_password_hash

app = AsyncTyper()


async def check_user_exists(username: str) -> bool:
    async with AsyncSessionLocal() as session:
        result = await session.exec(select(User).where(User.username == username))
        existing = result.first()
        return existing is not None


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


@app.async_command()
async def change_password(
    username: str = typer.Option(None, help="Username for the existing user"),
):
    if not username:
        username = await asyncio.to_thread(typer.prompt, "Username")

    if not await check_user_exists(username):
        typer.echo(f"User {username} not found")
        raise typer.Exit(code=1)

    password = await asyncio.to_thread(getpass, "Password: ")
    confirm_password = await asyncio.to_thread(getpass, "Confirm Password: ")

    if password != confirm_password:
        typer.echo("Passwords do not match!")
        raise typer.Exit(code=1)

    hashed_password = await asyncio.to_thread(get_password_hash, password)
    await update_user_password(username, hashed_password)
