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


async def add_user_async(username: str, email: str | None, password_hash: str):
    async with AsyncSessionLocal() as session:
        user = User(username=username, email=email, password_hash=password_hash)
        session.add(user)
        await session.commit()
        await session.refresh(user)
        typer.echo(f"User {username} added with id {user.id}.")


@app.async_command()
async def add_user(
    email: str = typer.Option(None, help="Email for the new user"),
    username: str = typer.Option(None, help="Username for the new user"),
):
    if not username:
        username = await asyncio.to_thread(typer.prompt, "Username")

    if await check_user_exists(username):
        typer.echo(f"User {username} already exists!")
        raise typer.Exit(code=1)

    while True:
        password = await asyncio.to_thread(getpass, "Password: ")
        confirm_password = await asyncio.to_thread(getpass, "Confirm Password: ")

        if password == confirm_password:
            break
        else:
            typer.echo("Passwords do not match!")
            typer.echo("Please type again")

    hashed_password = await asyncio.to_thread(get_password_hash, password)
    await add_user_async(username=username, email=email, password_hash=hashed_password)
