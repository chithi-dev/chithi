"""File-system helpers (temp-file cleanup, etc.)."""

from pathlib import Path


def cleanup(*paths: Path) -> None:
    """Silently remove temporary files."""
    for p in paths:
        try:
            p.unlink(missing_ok=True)
        except OSError:
            pass
