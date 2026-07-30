"""Copy the chithi-sdk Python wheel into cli/vendor/ and install via uv add.

Usage:
    python scripts/copy_python_sdk.py               # Copy wheel + uv add
    python scripts/copy_python_sdk.py --develop      # uv add --editable
    python scripts/copy_python_sdk.py --wheel <path> # Use specific wheel
"""

import argparse
import logging
import pathlib
import shutil
import subprocess
import sys
from typing import Final

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

_REPO_ROOT: Final = pathlib.Path(__file__).resolve().parent.parent
_PYTHON_SDK_DIR: Final = _REPO_ROOT / "sdks" / "python"
_SDK_DIST_DIR: Final = _PYTHON_SDK_DIR / "dist"
_CLI_DIR: Final = _REPO_ROOT / "src" / "cli"
_CLI_VENDOR_DIR: Final = _CLI_DIR / "vendor"

logger = logging.getLogger("copy_python_sdk")

# ---------------------------------------------------------------------------
# Logging helpers
# ---------------------------------------------------------------------------


def _setup_logging(verbose: bool) -> None:
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%H:%M:%S",
    )


def _error(message: str, hint: str | None = None) -> None:
    logger.error(message)
    if hint:
        logger.warning("Hint: %s", hint)
    sys.exit(1)


def _ok(message: str) -> None:
    logger.info(message)


def _warn(message: str) -> None:
    logger.warning(message)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _has_uv() -> bool:
    """Check if uv is available."""
    try:
        result = subprocess.run(
            ["uv", "--version"],
            capture_output=True,
            text=True,
        )
        if result.returncode == 0:
            logger.debug("uv: %s", result.stdout.strip())
            return True
    except FileNotFoundError:
        pass
    return False


def _ensure_vendor_dir() -> None:
    """Create the vendor/ directory if it doesn't exist."""
    if not _CLI_VENDOR_DIR.exists():
        logger.debug("Creating vendor directory: %s", _CLI_VENDOR_DIR)
        _CLI_VENDOR_DIR.mkdir(parents=True, exist_ok=True)


def _find_latest_wheel() -> pathlib.Path:
    """Find the most recently built wheel in the SDK dist directory."""
    if not _SDK_DIST_DIR.exists():
        _error(
            f"No dist/ directory at {_SDK_DIST_DIR}.",
            hint="Run 'python scripts/build_python_sdk.py' to build the wheel first.",
        )

    wheels = list(_SDK_DIST_DIR.glob("*.whl"))
    if not wheels:
        _error(
            f"No .whl files found in {_SDK_DIST_DIR}.",
            hint="Run 'python scripts/build_python_sdk.py' to build the wheel first.",
        )

    wheel = max(wheels, key=lambda p: p.stat().st_mtime)
    logger.debug("Found wheel: %s", wheel.name)
    return wheel


def _copy_wheel_to_vendor(wheel_path: pathlib.Path) -> pathlib.Path:
    """Copy the wheel file into cli/vendor/ and return the new path."""
    _ensure_vendor_dir()

    dest = _CLI_VENDOR_DIR / wheel_path.name
    if dest.exists():
        logger.debug("Removing existing wheel: %s", dest)
        dest.unlink()

    logger.info("Copying %s to vendor/", wheel_path.name)
    shutil.copy2(str(wheel_path), str(dest))
    return dest


def _uv_add_wheel(wheel_path: pathlib.Path) -> None:
    """Add the wheel as a dependency using uv add, then sync."""
    if not _has_uv():
        _error(
            "uv not found.",
            hint="Install uv: https://docs.astral.sh/uv/getting-started/installation/",
        )

    logger.info("Adding %s via uv add...", wheel_path.name)

    cmd = [
        "uv",
        "add",
        str(wheel_path),
    ]

    result = subprocess.run(
        cmd,
        cwd=str(_CLI_DIR),
        capture_output=True,
        text=True,
    )

    if result.returncode != 0:
        logger.error(result.stderr)
        _error(
            "uv add failed.",
            hint=f"Try: uv add {wheel_path}",
        )

    _ok("Wheel added via uv successfully.")


def _uv_sync() -> None:
    """Sync the CLI environment using uv sync."""
    if not _has_uv():
        _error(
            "uv not found.",
            hint="Install uv: https://docs.astral.sh/uv/getting-started/installation/",
        )

    logger.info("Syncing CLI environment via uv sync...")

    cmd = ["uv", "sync"]

    result = subprocess.run(
        cmd,
        cwd=str(_CLI_DIR),
        capture_output=True,
        text=True,
    )

    if result.returncode != 0:
        logger.error(result.stderr)
        _error("uv sync failed.", hint="Try: uv sync")

    _ok("uv sync complete.")


def _uv_add_develop() -> None:
    """Add the SDK as an editable dependency using uv add --editable."""
    if not _has_uv():
        _error(
            "uv not found.",
            hint="Install uv: https://docs.astral.sh/uv/getting-started/installation/",
        )

    logger.info("Adding SDK in development mode via uv add --editable...")

    cmd = [
        "uv",
        "add",
        "--editable",
        str(_PYTHON_SDK_DIR),
    ]

    result = subprocess.run(
        cmd,
        cwd=str(_CLI_DIR),
        capture_output=True,
        text=True,
    )

    if result.returncode != 0:
        logger.error(result.stderr)
        _error(
            "uv add --editable failed.",
            hint=f"Try: uv add --editable {_PYTHON_SDK_DIR}",
        )

    _ok("Development installation complete.")


def _verify_install() -> None:
    """Verify that chithi_sdk is importable in the CLI environment."""
    logger.info("Verifying installation...")

    cmd = [
        "uv",
        "run",
        "python",
        "-c",
        "import chithi_sdk; print(chithi_sdk.__file__)",
    ]

    result = subprocess.run(
        cmd,
        cwd=str(_CLI_DIR),
        capture_output=True,
        text=True,
    )

    if result.returncode != 0:
        logger.error(result.stderr)
        _error(
            "chithi_sdk is not importable.",
            hint="The SDK may not be installed correctly.",
        )

    _ok(f"chithi_sdk loaded from {result.stdout.strip()}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Copy chithi-sdk Python wheel into cli/vendor/ and install via uv add.",
    )
    parser.add_argument(
        "--develop",
        action="store_true",
        help="Install in development mode (uv add --editable).",
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Verbose output.",
    )
    parser.add_argument(
        "--wheel",
        type=pathlib.Path,
        default=None,
        help="Path to a specific .whl file to install.",
    )
    parser.add_argument(
        "--no-verify",
        action="store_true",
        help="Skip verification after installation.",
    )
    args = parser.parse_args()

    _setup_logging(args.verbose)

    if args.develop:
        _uv_add_develop()
    else:
        if args.wheel:
            if not args.wheel.exists():
                _error(f"Wheel not found: {args.wheel}")
            wheel = _copy_wheel_to_vendor(args.wheel)
        else:
            wheel = _copy_wheel_to_vendor(_find_latest_wheel())

        _uv_add_wheel(wheel)
        _uv_sync()

    if not args.no_verify:
        _verify_install()

    _ok("Done. chithi-sdk is ready in the CLI environment.")


if __name__ == "__main__":
    main()
