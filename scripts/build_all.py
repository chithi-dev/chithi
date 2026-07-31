"""Master build script — builds everything in the correct order.

Usage:
    python scripts/build_all.py              # Full build
    python scripts/build_all.py --wasm-only  # Only build WASM
    python scripts/build_all.py --python-only # Only build Python wheel
    python scripts/build_all.py --check      # Verify toolchain
"""

import argparse
import subprocess
import sys

_SCRIPTS_DIR = __file__.resolve().parent


def run(script: str, *args: str) -> None:
    """Run a build script via subprocess."""
    cmd = [sys.executable, str(_SCRIPTS_DIR / script), *args]
    print(f"\n{'=' * 60}")
    print(f"[RUN] {' '.join(cmd[3:])}")
    print(f"{'=' * 60}")
    try:
        subprocess.run(cmd, check=True)
    except subprocess.CalledProcessError as e:
        print(f"[ERROR] {script} failed with exit code {e.returncode}")
        sys.exit(e.returncode)


def main() -> None:
    parser = argparse.ArgumentParser(description="Build all chithi components")
    parser.add_argument("--wasm-only", action="store_true", help="Build WASM only")
    parser.add_argument("--python-only", action="store_true", help="Build Python wheel only")
    parser.add_argument("--debug", action="store_true", help="Debug build")
    parser.add_argument("--check", action="store_true", help="Check toolchain only")
    parser.add_argument("--develop", action="store_true", help="Install Python in dev mode")
    args = parser.parse_args()

    if args.check:
        run("build_wasm.py", "--check")
        return

    debug = ["--debug"] if args.debug else []

    # Step 1 — build WASM once
    if not args.python_only:
        run("build_wasm.py", *debug)

    if args.wasm_only:
        print("\n[DONE] WASM build complete.")
        return

    # Step 2 — build Python SDK (reuse WASM)
    run("build_python_sdk.py", *debug, "--no-wasm")

    # Step 3 — build JS SDK (reuse WASM)
    run("build_js_sdk.py", *debug, "--no-wasm")

    print("\n[DONE] Full build complete.")


if __name__ == "__main__":
    main()
