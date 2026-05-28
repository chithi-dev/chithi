"""Login command for Chithi CLI."""

from __future__ import annotations

from pathlib import Path

import async_typer as typer
from rich.console import Console

app: typer.AsyncTyper = typer.AsyncTyper(help="Login to a Chithi instance.")
console: Console = Console()


@app.async_command()
async def login(
    username: str = typer.Argument(..., help="Username or email"),
    password: str = typer.Option("", "--password", "-p", prompt=True, hide_input=True),
    instance_url: str | None = typer.Option(None, "--url", "-u"),
) -> None:
    """Login and save JWT token for authenticated requests."""
    from cli.core.graphql_client import GraphQLClient
    from cli.core.urls import resolve_graphql_url

    graphql_url = resolve_graphql_url(instance_url)

    async with GraphQLClient(graphql_url) as client:
        result = await client.login(username, password)  # type: ignore[arg-type]

    token = result.get("login", {}).get("accessToken")
    if not token:
        console.print("[red]Login failed: no access token received[/red]")
        raise typer.Exit(code=1)

    # Save token to local file (for future authenticated requests)
    config_dir = Path.home() / ".config" / "chithi"
    config_dir.mkdir(parents=True, exist_ok=True)
    config_file = config_dir / "auth.json"
    import json  # noqa: F401

    config_data = {
        "instance_url": instance_url or "",
        "token": token,
    }
    with open(config_file, "w") as f:
        json.dump(config_data, f)

    console.print("[green]Login successful![/green]")
    console.print(f"  Token saved to {config_file}")
