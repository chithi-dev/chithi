from async_typer import AsyncTyper
import py7zr

app = AsyncTyper()


@app.async_command()
async def hello(name: str):
    filters = [
        {
            "id": py7zr.FILTER_LZMA2,
            "preset": 9,
            "dict_size": 1024 * 1024 * 512,
        }
    ]
    with py7zr.SevenZipFile(
        "Archive.7z",
        "w",
        filters=filters,
    ) as archive:
        archive.writeall("test/")
