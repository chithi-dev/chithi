import typer
from sqlmodel import select

from app.vendor.async_typer import AsyncTyper
from app.db import AsyncSessionLocal
from app.models import User

app = AsyncTyper()


async def list_users_async():
    async with AsyncSessionLocal() as session:
        result = await session.exec(select(User))
        users = result.all()

        if not users:
            typer.echo("No users found.")
            return

        typer.echo(f"{'Username':<20} | {'Email':<30} | {'ID':<40}")
        typer.echo("-" * 95)
        for user in users:
            email = str(user.email) if user.email else "N/A"
            typer.echo(f"{user.username:<20} | {email:<30} | {user.id}")


@app.async_command()
async def list_users():
    await list_users_async()
