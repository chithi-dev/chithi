"""Copy the chithi-sdk JS package into src/frontend/src/vendor/ and install via npm.

Usage:
    python scripts/copy_js_sdk.py                # Copy built SDK + npm install
    python scripts/copy_js_sdk.py --develop       # Symlink for live development
    python scripts/copy_js_sdk.py --build         # Build SDK + copy
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
_JS_SDK_DIR: Final = _REPO_ROOT / "sdks" / "js"
_SDK_DIST_DIR: Final = _JS_SDK_DIR / "dist"
_FRONTEND_DIR: Final = _REPO_ROOT / "src" / "frontend"
_FRONTEND_SRC_DIR: Final = _FRONTEND_DIR / "src"
_VENDOR_DIR: Final = _FRONTEND_SRC_DIR / "vendor"

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


def _ensure_vendor_dir() -> None:
    """Create the vendor/ directory if it doesn't exist."""
    if not _VENDOR_DIR.exists():
        logger.debug("Creating vendor directory: %s", _VENDOR_DIR)
        _VENDOR_DIR.mkdir(parents=True, exist_ok=True)


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


def _copy_sdk_to_vendor() -> None:
    """Copy the built SDK dist/ into src/vendor/."""
    if not _SDK_DIST_DIR.exists():
        _error(
            f"SDK dist/ directory not found at {_SDK_DIST_DIR}.",
            hint="Run with --build to build the SDK first.",
        )

    dist_files = list(_SDK_DIST_DIR.iterdir())
    if not dist_files:
        _error(
            f"SDK dist/ directory is empty: {_SDK_DIST_DIR}",
            hint="Run with --build to build the SDK first.",
        )

    logger.debug("SDK dist contents: %s", [f.name for f in dist_files])

    _ensure_vendor_dir()

    # Remove existing target
    target_sdk = _VENDOR_DIR / "chithi-sdk"
    if target_sdk.exists():
        logger.debug("Removing existing SDK: %s", target_sdk)
        if target_sdk.is_symlink():
            target_sdk.unlink()
        else:
            shutil.rmtree(str(target_sdk))

    # Copy SDK dist/ as the package directory
    logger.info("Copying SDK to vendor/chithi-sdk...")
    shutil.copytree(
        str(_SDK_DIST_DIR),
        str(target_sdk),
        symlinks=False,
    )

    # Copy the SDK's package.json (so npm can resolve metadata)
    sdk_package = _JS_SDK_DIR / "package.json"
    if sdk_package.exists():
        target_package = target_sdk / "package.json"
        if not target_package.exists():
            logger.debug("Copying SDK package.json")
            shutil.copy2(str(sdk_package), str(target_package))

    _ok("SDK copied to vendor/ successfully.")


def _symlink_sdk() -> None:
    """Create a symlink from vendor/ to the SDK dist/ directory."""
    if not _SDK_DIST_DIR.exists():
        _error(
            f"SDK dist/ directory not found at {_SDK_DIST_DIR}.",
            hint="Run with --build to build the SDK first.",
        )

    _ensure_vendor_dir()

    target_sdk = _VENDOR_DIR / "chithi-sdk"
    if target_sdk.exists():
        logger.debug("Removing existing target: %s", target_sdk)
        if target_sdk.is_symlink():
            target_sdk.unlink()
        else:
            shutil.rmtree(str(target_sdk))

    logger.info("Symlinking SDK to vendor/chithi-sdk...")
    target_sdk.symlink_to(
        _SDK_DIST_DIR.resolve(),
        target_is_directory=True,
    )

    _ok("SDK symlinked successfully.")


def _npm_install() -> None:
    """Install the vendor package into the frontend via npm install."""
    if not _has_npm():
        _error(
            "npm not found.",
            hint="Install Node.js to install the JS SDK.",
        )

    target_sdk = _VENDOR_DIR / "chithi-sdk"
    logger.info("Installing vendor/chithi-sdk via npm install...")

    cmd = [
        "npm",
        "install",
        str(target_sdk),
        "--save",
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
            "npm install failed.",
            hint=f"Try: npm install {target_sdk}",
        )

    _ok("npm install complete.")


def _cleanup_vendor() -> None:
    """Remove the vendor/ directory after npm has installed the package."""
    if not _VENDOR_DIR.exists():
        return

    logger.info("Cleaning up vendor/ directory...")
    shutil.rmtree(str(_VENDOR_DIR))
    _ok("Vendor directory removed.")


def _verify_install() -> None:
    """Verify that chithi-sdk is importable in the frontend."""
    if not _has_npm():
        _warn("npm not found — skipping verification.")
        return

    logger.info("Verifying installation...")

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
        description="Copy chithi-sdk JS package into src/vendor/ and install via npm.",
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
        _copy_sdk_to_vendor()

    _npm_install()
    _cleanup_vendor()

    if not args.no_verify:
        _verify_install()

    _ok("Done. chithi-sdk is ready in the frontend environment.")


if __name__ == "__main__":
    main()
