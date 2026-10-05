import io
import sys

from app.main import app

if sys.stdout.encoding != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")


def main() -> None:
    """Invoke the CLI application."""
    app()


if __name__ == "__main__":
    main()
