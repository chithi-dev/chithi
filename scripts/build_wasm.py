"""Build the chithi WASM module and deploy to consumers.

Usage:
    python scripts/build_wasm.py          # Build and deploy
    python scripts/build_wasm.py --debug  # Debug build
    python scripts/build_wasm.py --check  # Only verify toolchain
    python scripts/build_wasm.py --no-deploy  # Build only, skip deploy
"""

import argparse
import json
import os
import pathlib
import platform
import shutil
import subprocess
import sys

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

_REPO_ROOT = pathlib.Path(__file__).resolve().parent.parent
_CRATES_DIR = _REPO_ROOT / "crates"
_WASM_BINDINGS = _CRATES_DIR / "wasm_bindings"

_FRONTEND_WASM_DIR = _REPO_ROOT / "src" / "frontend" / "src" / "lib" / "wasm"
_CLI_WASM_DIR = _REPO_ROOT / "src" / "cli"
_PYTHON_WASM_DIR = _REPO_ROOT / "sdks" / "python" / "src" / "chithi_sdk"
_JS_WASM_DIR = _REPO_ROOT / "sdks" / "js" / "dist"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _is_windows() -> bool:
    return platform.system().lower() == "windows"


def _error(message: str, hint: str | None = None) -> None:
    """Print a styled error message and exit."""
    print(f"\n[ERROR] {message}", file=sys.stderr)
    if hint:
        print(f"[HINT]  {hint}", file=sys.stderr)
    sys.exit(1)


def _warn(message: str) -> None:
    print(f"[WARN]  {message}", file=sys.stderr)


def _ok(message: str) -> None:
    print(f"[OK]    {message}")


def _info(message: str) -> None:
    print(f"[INFO]  {message}")


# ---------------------------------------------------------------------------
# Toolchain checks
# ---------------------------------------------------------------------------


def _check_command(command: str, install_hint: str) -> str | None:
    """Return the resolved path of *command*, or None if missing."""
    path = shutil.which(command)
    if path is None:
        _error(
            f"'{command}' is not available in PATH.",
            hint=install_hint,
        )
    return path


def check_toolchain() -> bool:
    """Verify Rust, cargo, and the wasm32-unknown-unknown target are available."""
    cargo = _check_command(
        "cargo",
        "Install Rust from https://rustup.rs/",
    )

    # Verify cargo actually works
    try:
        result = subprocess.run(
            [cargo, "--version"],
            capture_output=True,
            text=True,
            timeout=15,
        )
        if result.returncode != 0:
            _error(
                f"cargo returned an error: {result.stderr.strip()}",
                hint="Re-run 'rustup update' to fix your toolchain.",
            )
    except subprocess.TimeoutExpired:
        _error("cargo --version timed out.", hint="Check if cargo is hanging.")
    except FileNotFoundError:
        _error("cargo binary disappeared after detection.", hint="Reinstall Rust.")

    _info(f"Rust toolchain: {result.stdout.strip()}")

    # Check wasm32-unknown-unknown target via rustup
    rustup = shutil.which("rustup")
    if rustup:
        try:
            result = subprocess.run(
                [rustup, "target", "list", "--installed"],
                capture_output=True,
                text=True,
                timeout=15,
            )
            if result.returncode == 0 and "wasm32-unknown-unknown" not in result.stdout:
                _error(
                    "The 'wasm32-unknown-unknown' target is not installed.",
                    hint="Run: rustup target add wasm32-unknown-unknown",
                )
        except subprocess.TimeoutExpired:
            _warn("Checking targets timed out, skipping target check.")
    else:
        _warn("rustup not found in PATH, skipping target verification.")

    _ok("Toolchain is ready.")
    return True


# ---------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------


def build_wasm(debug: bool = False) -> pathlib.Path:
    """Compile the wasm_bindings crate and return the .wasm path."""
    cargo = _check_command(
        "cargo",
        "Install Rust from https://rustup.rs/",
    )

    # Verify the crate exists
    if not _WASM_BINDINGS.is_dir():
        _error(
            f"wasm_bindings crate directory not found at {_WASM_BINDINGS}",
            hint="Check that 'crates/wasm_bindings' exists in the repo.",
        )

    cargo_toml = _WASM_BINDINGS / "Cargo.toml"
    if not cargo_toml.is_file():
        _error(
            f"Cargo.toml not found at {cargo_toml}",
            hint="The wasm_bindings crate is missing its manifest.",
        )

    profile = "debug" if debug else "release"
    cmd = [
        cargo,
        "build",
        "-p",
        "wasm_bindings",
        "--target",
        "wasm32-unknown-unknown",
        "--target-dir",
        str(_REPO_ROOT / "target"),
    ]
    if not debug:
        cmd.append("--release")

    _info(f"Building: {' '.join(cmd)}")

    try:
        result = subprocess.run(
            cmd,
            cwd=str(_REPO_ROOT),
            check=True,
        )
    except subprocess.CalledProcessError as e:
        _error(
            f"WASM build failed with exit code {e.returncode}.",
            hint="Check Rust compilation errors above. Try 'cargo check -p wasm_bindings --target wasm32-unknown-unknown' for a faster diagnostic.",
        )
    except FileNotFoundError:
        _error("cargo disappeared after detection.", hint="Reinstall Rust.")

    # Locate the .wasm output
    wasm_dir = _REPO_ROOT / "target" / "wasm32-unknown-unknown" / profile
    wasm_file = wasm_dir / "wasm_bindings.wasm"

    if not wasm_file.exists():
        # Scan for any .wasm in the target directory
        if wasm_dir.exists():
            found = list(wasm_dir.glob("*.wasm"))
            if found:
                _warn(f"Expected wasm_bindings.wasm, found: {[f.name for f in found]}")
        _error(
            f"WASM output not found at {wasm_file}",
            hint="Check the build output above for compilation errors.",
        )

    size_kb = wasm_file.stat().st_size / 1024
    _ok(f"Built wasm_bindings.wasm ({size_kb:.1f} KB)")
    return wasm_file


# ---------------------------------------------------------------------------
# Deploy
# ---------------------------------------------------------------------------


def _copy_wasm(wasm_file: pathlib.Path, dest_dir: pathlib.Path, name: str = "chithi.wasm") -> None:
    """Copy the WASM file to a destination directory."""
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / name
    shutil.copy2(wasm_file, dest)
    _info(f"Deployed to {dest}")


def deploy(wasm_file: pathlib.Path) -> None:
    """Copy the WASM module to all consumer directories."""
    _copy_wasm(wasm_file, _FRONTEND_WASM_DIR, "chithi.wasm")
    _copy_wasm(wasm_file, _CLI_WASM_DIR, "chithi.wasm")
    _copy_wasm(wasm_file, _PYTHON_WASM_DIR, "chithi.wasm")
    _copy_wasm(wasm_file, _JS_WASM_DIR, "chithi.wasm")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Build the chithi WASM module and deploy to consumers.",
    )
    parser.add_argument(
        "--debug",
        action="store_true",
        help="Build in debug mode (faster, larger binary).",
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Only verify the toolchain and exit.",
    )
    parser.add_argument(
        "--no-deploy",
        action="store_true",
        help="Build only, do not copy the .wasm to consumers.",
    )
    args = parser.parse_args()

    # Step 1 — toolchain
    check_toolchain()
    if args.check:
        return

    # Step 2 — build
    wasm_file = build_wasm(debug=args.debug)

    # Step 3 — deploy
    if args.no_deploy:
        _info("Skipping deployment (--no-deploy).")
        return

    deploy(wasm_file)
    _ok("WASM build and deployment complete.")


if __name__ == "__main__":
    main()
