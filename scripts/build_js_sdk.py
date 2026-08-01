"""Build the chithi JS SDK with WASM bundled inside.

Usage:
    python scripts/build_js_sdk.py                # Build + output dist/
    python scripts/build_js_sdk.py --debug         # Debug WASM build
    python scripts/build_js_sdk.py --no-wasm       # Skip WASM, reuse existing
    python scripts/build_js_sdk.py --check         # Verify toolchain only
    python scripts/build_js_sdk.py --info          # Print dist/ contents
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
_CRATES_DIR: Final = _REPO_ROOT / "crates"
_WASM_BINDINGS_DIR: Final = _CRATES_DIR / "wasm_bindings"
_JS_SDK_DIR: Final = _REPO_ROOT / "sdks" / "js"
_JS_DIST_DIR: Final = _JS_SDK_DIR / "dist"
_WASM_OUTPUT_DIR: Final = _REPO_ROOT / "target"

logger = logging.getLogger("build_js_sdk")

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
    """Verify Rust, Node.js, npm, and wasm32 target are available."""
    # Rust
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

    # wasm32 target
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

    # Node.js
    node = _find_command("node", "Install Node.js from https://nodejs.org/")
    node_result = subprocess.run(
        [str(node), "--version"],
        capture_output=True,
        text=True,
        timeout=10,
    )
    if node_result.returncode == 0:
        logger.info("Node.js: %s", node_result.stdout.strip())

    # npm
    npm = _find_command("npm", "Install npm with Node.js from https://nodejs.org/")
    npm_result = subprocess.run(
        [str(npm), "--version"],
        capture_output=True,
        text=True,
        timeout=10,
    )
    if npm_result.returncode == 0:
        logger.info("npm: %s", npm_result.stdout.strip())

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
# JS SDK build
# ---------------------------------------------------------------------------


def _install_deps() -> None:
    """Install JS SDK dependencies."""
    package_json = _JS_SDK_DIR / "package.json"
    if not package_json.exists():
        _error(f"package.json not found at {package_json}")

    _find_command("node", "Install Node.js from https://nodejs.org/")
    npm = _find_command("npm", "Install npm with Node.js from https://nodejs.org/")

    # Check if node_modules exists
    node_modules = _JS_SDK_DIR / "node_modules"
    if not node_modules.exists():
        logger.info("Installing JS SDK dependencies...")
        result = subprocess.run(
            [str(npm), "install"],
            cwd=str(_JS_SDK_DIR),
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            logger.error(result.stderr)
            _error(
                "npm install failed.",
                hint="Check package.json for errors.",
            )
        _ok("Dependencies installed.")
    else:
        logger.debug("node_modules already exists, skipping install.")


def _copy_wasm_for_build(wasm_file: pathlib.Path) -> None:
    """Copy the WASM module to the JS SDK root for the build step."""
    dest = _JS_SDK_DIR / "chithi.wasm"
    shutil.copy2(wasm_file, dest)
    logger.info("Copied WASM to SDK root for bundling.")


def _clean_wasm_after_build() -> None:
    """Remove chithi.wasm from the JS SDK root after bundling.

    The WASM is already baked into dist/index.js as compressed hex,
    so the raw .wasm file is no longer needed.
    """
    leftover = _JS_SDK_DIR / "chithi.wasm"
    if leftover.exists():
        leftover.unlink()
        logger.info("Removed chithi.wasm from SDK root (already baked into bundle).")
    else:
        logger.debug("No chithi.wasm to clean up.")


def build_js_sdk() -> None:
    """Build the JS SDK with WASM."""
    _install_deps()

    logger.info("Building JS SDK...")

    npm = _find_command("npm", "Install npm with Node.js from https://nodejs.org/")
    result = subprocess.run(
        [str(npm), "run", "build"],
        cwd=str(_JS_SDK_DIR),
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )

    if result.returncode != 0:
        logger.error(result.stderr)
        _error(
            "JS SDK build failed.",
            hint="Check TypeScript compilation errors above.",
        )

    # Check for dist/ contents
    if _JS_DIST_DIR.exists():
        js_files = list(_JS_DIST_DIR.glob("*.js"))
        dts_files = list(_JS_DIST_DIR.glob("*.d.ts"))
        logger.debug("Compiled %d .js files and %d .d.ts files.", len(js_files), len(dts_files))
    else:
        _error("dist/ directory not found after build.")

    _clean_wasm_after_build()

    _ok("JS SDK build complete.")


# ---------------------------------------------------------------------------
# Dist info
# ---------------------------------------------------------------------------


def _print_dist_info() -> None:
    """Print dist/ directory contents and sizes."""
    if not _JS_DIST_DIR.exists():
        _warn("dist/ directory not found.")
        return

    logger.info("dist/ contents:")
    for item in sorted(_JS_DIST_DIR.iterdir()):
        if item.is_file():
            size_kb = item.stat().st_size / 1024
            logger.info("  %s (%.1f KB)", item.name, size_kb)
        else:
            logger.info("  %s/", item.name)

    # Print package.json info
    package_json = _JS_SDK_DIR / "package.json"
    if package_json.exists():
        with open(package_json, encoding="utf-8") as f:
            pkg = json.load(f)
        logger.info("Package: %s@%s", pkg.get("name"), pkg.get("version"))
        logger.info("Main: %s", pkg.get("main"))
        logger.info("Types: %s", pkg.get("types"))


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Build chithi JS SDK with bundled WASM.",
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
        "--info",
        action="store_true",
        help="Print dist/ contents after build.",
    )
    args = parser.parse_args()

    _setup_logging(args.verbose)

    # Step 1 — toolchain
    check_toolchain()
    if args.check:
        return

    # Step 2 — build WASM (unless skipped)
    if args.no_wasm:
        existing_wasm = _JS_DIST_DIR / "chithi.wasm"
        if existing_wasm.exists():
            _ok(f"Reusing existing WASM at {existing_wasm}")
            wasm_file = existing_wasm
        else:
            # Check src/ as fallback
            src_wasm = _JS_SDK_DIR / "src" / "chithi.wasm"
            if src_wasm.exists():
                _ok(f"Reusing existing WASM at {src_wasm}")
                wasm_file = src_wasm
            else:
                _error(
                    "No existing WASM found and --no-wasm was specified.",
                    hint="Remove --no-wasm to build WASM, or ensure chithi.wasm exists.",
                )
    else:
        wasm_file = build_wasm(debug=args.debug)

    # Step 3 — copy WASM for build
    _copy_wasm_for_build(wasm_file)

    # Step 4 — build JS SDK
    build_js_sdk()

    # Step 5 — info
    if args.info:
        _print_dist_info()

    _ok(f"Done. JS SDK is at {_JS_DIST_DIR}")


if __name__ == "__main__":
    main()
