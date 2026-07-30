"""Copy the chithi-sdk JS package into the frontend node_modules.

Usage:
    python scripts/copy_js_sdk.py                # Copy built SDK
    python scripts/copy_js_sdk.py --develop       # Symlink for live development
    python scripts/copy_js_sdk.py --build         # Build SDK + copy
"""

import argparse
import json
import logging
import os
import pathlib
import shutil
import subprocess
import sys
from typing import Final

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

_REPO_ROOT: Final = pathlib.Path(__file__).resolve().parent.parent
_JS_SDK_DIR: Final = _REPO_ROOT / "sdks" / "js"
_SDK_DIST_DIR: Final = _JS_SDK_DIR / "dist"
_FRONTEND_DIR: Final = _REPO_ROOT / "src" / "frontend"
_FRONTEND_NODE_MODULES: Final = _FRONTEND_DIR / "node_modules"
_TARGET_DIR: Final = _FRONTEND_NODE_MODULES / "chithi-sdk"

logger = logging.getLogger("copy_js_sdk")

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


def _has_node() -> bool:
    """Check if Node.js is available."""
    try:
        result = subprocess.run(
            ["node", "--version"],
            capture_output=True,
            text=True,
        )
        if result.returncode == 0:
            logger.debug("Node.js: %s", result.stdout.strip())
            return True
    except FileNotFoundError:
        pass
    return False


def _has_npm() -> bool:
    """Check if npm is available."""
    try:
        result = subprocess.run(
            ["npm", "--version"],
            capture_output=True,
            text=True,
        )
        if result.returncode == 0:
            logger.debug("npm: %s", result.stdout.strip())
            return True
    except FileNotFoundError:
        pass
    return False


def _build_sdk() -> None:
    """Build the JS SDK using npm."""
    if not _has_npm():
        _error(
            "npm not found.",
            hint="Install Node.js to build the JS SDK.",
        )

    logger.info("Building JS SDK...")

    result = subprocess.run(
        ["npm", "run", "build"],
        cwd=str(_JS_SDK_DIR),
        capture_output=True,
        text=True,
    )

    if result.returncode != 0:
        logger.error(result.stderr)
        _error(
            "JS SDK build failed.",
            hint=f"Run 'npm run build' in {_JS_SDK_DIR} manually.",
        )

    _ok("JS SDK built successfully.")


def _copy_sdk() -> None:
    """Copy the built SDK dist/ into the frontend node_modules."""
    if not _SDK_DIST_DIR.exists():
        _error(
            f"SDK dist/ directory not found at {_SDK_DIST_DIR}.",
            hint="Run with --build to build the SDK first.",
        )

    # Check what files are in dist
    dist_files = list(_SDK_DIST_DIR.iterdir())
    if not dist_files:
        _error(
            f"SDK dist/ directory is empty: {_SDK_DIST_DIR}",
            hint="Run with --build to build the SDK first.",
        )

    logger.debug("SDK dist contents: %s", [f.name for f in dist_files])

    # Remove existing target
    if _TARGET_DIR.exists():
        logger.debug("Removing existing target: %s", _TARGET_DIR)
        if _TARGET_DIR.is_symlink():
            _TARGET_DIR.unlink()
        else:
            shutil.rmtree(str(_TARGET_DIR))

    # Copy SDK dist/ as the package directory
    logger.info("Copying SDK to node_modules/chithi-sdk...")
    shutil.copytree(
        str(_SDK_DIST_DIR),
        str(_TARGET_DIR),
        symlinks=False,
    )

    # Copy the SDK's package.json (so npm can resolve metadata)
    sdk_package = _JS_SDK_DIR / "package.json"
    if sdk_package.exists():
        target_package = _TARGET_DIR / "package.json"
        if not target_package.exists():
            logger.debug("Copying SDK package.json")
            shutil.copy2(str(sdk_package), str(target_package))

    _ok("SDK copied successfully.")


def _symlink_sdk() -> None:
    """Create a symlink from node_modules to the SDK dist/ directory."""
    if not _SDK_DIST_DIR.exists():
        _error(
            f"SDK dist/ directory not found at {_SDK_DIST_DIR}.",
            hint="Run with --build to build the SDK first.",
        )

    # Remove existing target
    if _TARGET_DIR.exists():
        logger.debug("Removing existing target: %s", _TARGET_DIR)
        if _TARGET_DIR.is_symlink():
            _TARGET_DIR.unlink()
        else:
            shutil.rmtree(str(_TARGET_DIR))

    # Create symlink
    logger.info("Symlinking SDK to node_modules/chithi-sdk...")
    _TARGET_DIR.symlink_to(
        _SDK_DIST_DIR.resolve(),
        target_is_directory=True,
    )

    _ok("SDK symlinked successfully.")


def _verify_install() -> None:
    """Verify that chithi-sdk is importable in the frontend."""
    if not _has_node():
        _warn("Node.js not found — skipping verification.")
        return

    logger.info("Verifying installation...")

    # Try to resolve the package
    cmd = [
        "node",
        "-e",
        "try { const p = require.resolve('chithi-sdk'); console.log(p); } catch(e) { console.error(e.message); process.exit(1); }",
    ]

    result = subprocess.run(
        cmd,
        cwd=str(_FRONTEND_DIR),
        capture_output=True,
        text=True,
    )

    if result.returncode != 0:
        logger.error(result.stderr)
        _error(
            "chithi-sdk cannot be resolved.",
            hint="The SDK may not be built or copied correctly.",
        )

    _ok(f"chithi-sdk resolved at {result.stdout.strip()}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Copy chithi-sdk JS package into the frontend node_modules.",
    )
    parser.add_argument(
        "--develop",
        action="store_true",
        help="Symlink SDK for live development (changes reflect immediately).",
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Verbose output.",
    )
    parser.add_argument(
        "--build",
        action="store_true",
        help="Build the SDK before copying.",
    )
    parser.add_argument(
        "--no-verify",
        action="store_true",
        help="Skip verification after installation.",
    )
    args = parser.parse_args()

    _setup_logging(args.verbose)

    if args.build:
        _build_sdk()

    if args.develop:
        _symlink_sdk()
    else:
        _copy_sdk()

    if not args.no_verify:
        _verify_install()

    _ok("Done. chithi-sdk is ready in the frontend environment.")


if __name__ == "__main__":
    main()
