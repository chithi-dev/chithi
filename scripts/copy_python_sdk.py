"""Copy the chithi-sdk Python wheel into the CLI environment.

Usage:
    python scripts/copy_python_sdk.py                # Find latest wheel + install
    python scripts/copy_python_sdk.py --develop       # pip install -e
    python scripts/copy_python_sdk.py --wheel <path>  # Install specific wheel
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


def _find_cli_python() -> pathlib.Path:
    """Find the Python interpreter for the CLI environment."""
    # Check for uv-managed Python in the CLI directory
    uv_python = _CLI_DIR / ".venv"
    if uv_python.exists():
        # Determine the OS-specific Python executable
        if sys.platform == "win32":
            python_exe = uv_python / "Scripts" / "python.exe"
        else:
            python_exe = uv_python / "bin" / "python"

        if python_exe.exists():
            logger.debug("Found CLI Python at %s", python_exe)
            return python_exe

    # Fall back to the current Python interpreter
    logger.debug("Using current Python: %s", sys.executable)
    return pathlib.Path(sys.executable)


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

    # Return the most recently modified wheel
    wheel = max(wheels, key=lambda p: p.stat().st_mtime)
    logger.debug("Found wheel: %s", wheel.name)
    return wheel


def _install_wheel(wheel_path: pathlib.Path, cli_python: pathlib.Path) -> None:
    """Install a wheel into the CLI Python environment."""
    logger.info("Installing %s into CLI environment...", wheel_path.name)

    cmd = [
        str(cli_python),
        "-m",
        "pip",
        "install",
        "--force-reinstall",
        "--no-deps",
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
            "Wheel installation failed.",
            hint=f"Try: {cli_python} -m pip install {wheel_path}",
        )

    _ok("Wheel installed successfully.")


def _install_develop(cli_python: pathlib.Path) -> None:
    """Install the SDK in development mode (pip install -e)."""
    logger.info("Installing SDK in development mode...")

    cmd = [
        str(cli_python),
        "-m",
        "pip",
        "install",
        "-e",
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
            "Development installation failed.",
            hint=f"Try: {cli_python} -m pip install -e {_PYTHON_SDK_DIR}",
        )

    _ok("Development installation complete.")


def _verify_install(cli_python: pathlib.Path) -> None:
    """Verify that chithi_sdk is importable in the CLI environment."""
    logger.info("Verifying installation...")

    cmd = [
        str(cli_python),
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
        description="Copy chithi-sdk Python wheel into the CLI environment.",
    )
    parser.add_argument(
        "--develop",
        action="store_true",
        help="Install in development mode (pip install -e).",
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

    # Find CLI Python
    cli_python = _find_cli_python()
    logger.info("CLI Python: %s", cli_python)

    if args.develop:
        _install_develop(cli_python)
    else:
        # Find or use specified wheel
        if args.wheel:
            if not args.wheel.exists():
                _error(f"Wheel not found: {args.wheel}")
            wheel = args.wheel
        else:
            wheel = _find_latest_wheel()

        _install_wheel(wheel, cli_python)

    if not args.no_verify:
        _verify_install(cli_python)

    _ok("Done. chithi-sdk is ready in the CLI environment.")


if __name__ == "__main__":
    main()
