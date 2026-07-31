"""Build the chithi-sdk Python wheel with WASM bundled inside.

Usage:
    python scripts/build_python_sdk.py             # Build + output .whl
    python scripts/build_python_sdk.py --debug     # Debug WASM build
    python scripts/build_python_sdk.py --no-wasm   # Skip WASM, reuse existing
    python scripts/build_python_sdk.py --check     # Verify toolchain only
"""

import argparse
import json
import logging
import os
import pathlib
import platform
import shutil
import subprocess
import sys
import tempfile
import zipfile
from typing import Final

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

_REPO_ROOT: Final = pathlib.Path(__file__).resolve().parent.parent
_CRATES_DIR: Final = _REPO_ROOT / "crates"
_WASM_BINDINGS_DIR: Final = _CRATES_DIR / "wasm_bindings"
_PYTHON_SDK_DIR: Final = _REPO_ROOT / "sdks" / "python"
_SDK_SRC_DIR: Final = _PYTHON_SDK_DIR / "src" / "chithi_sdk"
_WASM_OUTPUT_DIR: Final = _REPO_ROOT / "target"

logger = logging.getLogger("build_python_sdk")

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
# Toolchain checks
# ---------------------------------------------------------------------------


def _find_command(name: str, install_hint: str) -> pathlib.Path:
    """Find an executable in PATH or exit."""
    path = shutil.which(name)
    if path is None:
        _error(
            f"'{name}' not found in PATH.",
            hint=install_hint,
        )
    return pathlib.Path(path)


def check_toolchain() -> None:
    """Verify Rust, cargo, and wasm32 target are available."""
    cargo = _find_command("cargo", "Install Rust from https://rustup.rs/")

    result = subprocess.run(
        [str(cargo), "--version"],
        capture_output=True,
        text=True,
        timeout=15,
    )
    if result.returncode != 0:
        _error(f"cargo error: {result.stderr.strip()}")

    logger.info("Rust toolchain: %s", result.stdout.strip())

    rustup = shutil.which("rustup")
    if rustup:
        target_result = subprocess.run(
            [rustup, "target", "list", "--installed"],
            capture_output=True,
            text=True,
            timeout=15,
        )
        if target_result.returncode == 0:
            targets = target_result.stdout.strip().splitlines()
            if "wasm32-unknown-unknown" not in targets:
                _error(
                    "wasm32-unknown-unknown target not installed.",
                    hint="Run: rustup target add wasm32-unknown-unknown",
                )
            logger.debug("WASM target: installed")
        else:
            _warn("Could not verify installed targets.")
    else:
        _warn("rustup not found, skipping target verification.")

    _ok("Toolchain is ready.")


# ---------------------------------------------------------------------------
# WASM build
# ---------------------------------------------------------------------------


def build_wasm(debug: bool = False) -> pathlib.Path:
    """Build the WASM module and return the .wasm path."""
    cargo = _find_command("cargo", "Install Rust from https://rustup.rs/")

    if not _WASM_BINDINGS_DIR.is_dir():
        _error(
            f"wasm_bindings crate not found at {_WASM_BINDINGS_DIR}.",
        )

    profile = "debug" if debug else "release"
    cmd = [
        str(cargo),
        "build",
        "-p",
        "wasm_bindings",
        "--target",
        "wasm32-unknown-unknown",
        "--target-dir",
        str(_WASM_OUTPUT_DIR),
    ]
    if not debug:
        cmd.append("--release")

    logger.info("Building WASM: %s", " ".join(cmd[1:4]))

    # Enable WASM GC support
    env = os.environ.copy()
    env["RUSTFLAGS"] = "-Ctarget-feature=+reference-types,+gc"

    result = subprocess.run(
        cmd,
        cwd=str(_REPO_ROOT),
        capture_output=True,
        text=True,
        env=env,
    )

    if result.returncode != 0:
        logger.error(result.stderr)
        _error(
            "WASM build failed.",
            hint="Try: cargo check -p wasm_bindings --target wasm32-unknown-unknown",
        )

    wasm_file = _WASM_OUTPUT_DIR / "wasm32-unknown-unknown" / profile / "wasm_bindings.wasm"

    if not wasm_file.exists():
        found = list(
            (_WASM_OUTPUT_DIR / "wasm32-unknown-unknown" / profile).glob("*.wasm")
        )
        if found:
            _warn(f"Expected wasm_bindings.wasm, found: {[f.name for f in found]}")
        _error(f"WASM output not found at {wasm_file}")

    size_kb = wasm_file.stat().st_size / 1024
    _ok(f"Built wasm_bindings.wasm ({size_kb:.1f} KB)")
    return wasm_file


# ---------------------------------------------------------------------------
# WASM bundle
# ---------------------------------------------------------------------------


def _bundle_wasm(wasm_file: pathlib.Path, dist_dir: pathlib.Path) -> pathlib.Path:
    """Build a .whl with the WASM module bundled inside.

    Creates a temporary build directory, copies the SDK source,
    drops the .wasm file into place, runs the build backend,
    and returns the path to the .whl in dist/.
    """
    pyproject = _PYTHON_SDK_DIR / "pyproject.toml"
    if not pyproject.exists():
        _error(f"pyproject.toml not found at {pyproject}")

    # Copy WASM into the SDK source tree
    wasm_dest = _SDK_SRC_DIR / "chithi.wasm"
    shutil.copy2(wasm_file, wasm_dest)
    logger.info("Bundled WASM into SDK source tree.")

    # Build the wheel
    dist_dir.mkdir(parents=True, exist_ok=True)
    logger.info("Building wheel...")

    # Try hatch first, fall back to pip
    hatch = shutil.which("hatch")
    if hatch:
        cmd = [
            hatch,
            "build",
            "--target",
            "wheel",
            "-d",
            str(dist_dir),
        ]
    else:
        cmd = [
            sys.executable,
            "-m",
            "pip",
            "wheel",
            "--no-deps",
            "-w",
            str(dist_dir),
            str(_PYTHON_SDK_DIR),
        ]

    result = subprocess.run(
        cmd,
        cwd=str(_PYTHON_SDK_DIR),
        capture_output=True,
        text=True,
    )

    if result.returncode != 0:
        logger.error(result.stderr)
        _error(
            "Wheel build failed.",
            hint="Ensure hatchling or pip is installed: pip install hatchling",
        )

    wheels = list(dist_dir.glob("*.whl"))
    if not wheels:
        _error("No .whl file found in dist/ after build.")

    wheel = max(wheels, key=lambda p: p.stat().st_mtime)
    size_mb = wheel.stat().st_size / (1024 * 1024)
    _ok(f"Built wheel: {wheel.name} ({size_mb:.2f} MB)")

    # Verify WASM is inside the wheel
    with zipfile.ZipFile(wheel) as zf:
        wasm_in_wheel = any("chithi.wasm" in name for name in zf.namelist())

    if wasm_in_wheel:
        _ok("WASM module is bundled inside the wheel.")
    else:
        _warn("WASM module not found inside the wheel — the wheel may not work.")

    return wheel


# ---------------------------------------------------------------------------
# Wheel info
# ---------------------------------------------------------------------------


def _print_wheel_info(wheel_path: pathlib.Path) -> None:
    """Print wheel contents and metadata."""
    logger.info("Wheel contents:")
    with zipfile.ZipFile(wheel_path) as zf:
        for name in zf.namelist():
            info = zf.getinfo(name)
            size_kb = info.file_size / 1024
            logger.info("  %s (%.1f KB)", name, size_kb)

    # Print metadata
    metadata_path = None
    with zipfile.ZipFile(wheel_path) as zf:
        for name in zf.namelist():
            if name.endswith("METADATA"):
                metadata_path = name
                break

    if metadata_path:
        with zipfile.ZipFile(wheel_path) as zf:
            metadata = zf.read(metadata_path).decode("utf-8")
        logger.info("Package metadata:")
        for line in metadata.splitlines()[:15]:
            logger.info("  %s", line)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Build chithi-sdk Python wheel with bundled WASM.",
    )
    parser.add_argument(
        "--debug",
        action="store_true",
        help="Build WASM in debug mode.",
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Verbose output.",
    )
    parser.add_argument(
        "--no-wasm",
        action="store_true",
        help="Skip WASM build (reuse existing chithi.wasm).",
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Verify toolchain and exit.",
    )
    parser.add_argument(
        "--output", "-o",
        type=pathlib.Path,
        default=None,
        help="Output directory for the wheel (default: sdks/python/dist/).",
    )
    parser.add_argument(
        "--info",
        action="store_true",
        help="Print wheel contents after build.",
    )
    args = parser.parse_args()

    _setup_logging(args.verbose)
    dist_dir = args.output or _PYTHON_SDK_DIR / "dist"

    # Step 1 — toolchain
    check_toolchain()
    if args.check:
        return

    # Step 2 — build WASM (unless skipped)
    if args.no_wasm:
        existing_wasm = _SDK_SRC_DIR / "chithi.wasm"
        if existing_wasm.exists():
            _ok(f"Reusing existing WASM at {existing_wasm}")
            wasm_file = existing_wasm
        else:
            _error(
                "No existing WASM found and --no-wasm was specified.",
                hint="Remove --no-wasm to build WASM, or ensure chithi.wasm exists in the SDK source.",
            )
    else:
        wasm_file = build_wasm(debug=args.debug)

    # Step 3 — build wheel
    wheel = _bundle_wasm(wasm_file, dist_dir)

    # Step 4 — info
    if args.info:
        _print_wheel_info(wheel)

    _ok(f"Done. Wheel is at {wheel}")


if __name__ == "__main__":
    main()
