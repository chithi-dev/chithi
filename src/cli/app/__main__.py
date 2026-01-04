import asyncio
from app.main import app as main_app

try:
    import uvloop  # type:ignore

    HAS_UVLOOP = True
except ImportError:
    HAS_UVLOOP = False


def main():
    app = main_app()
    if HAS_UVLOOP:
        uvloop.run(app)  # type:ignore
    else:
        asyncio.run(app)
