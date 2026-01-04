from async_typer import AsyncTyper

app = AsyncTyper()


@app.async_command()
async def hello(name: str):
    print(f"Hello {name}")
