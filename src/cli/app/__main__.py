import asyncio
from app.main import app

try:
    import uvloop  # type:ignore

    HAS_UVLOOP = True
except ImportError:
    HAS_UVLOOP = False


def main():
    if HAS_UVLOOP:
        uvloop.run(app())  # type:ignore
    else:
        asyncio.run(app())


if __name__ == "__main__":
    main()
