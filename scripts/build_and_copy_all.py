"""Build all components and copy outputs to their final destinations.

Usage:
    python scripts/build_and_copy_all.py           # Build + copy everything
    python scripts/build_and_copy_all.py --debug   # Debug build
    python scripts/build_and_copy_all.py --check   # Verify toolchain
"""

import argparse
import pathlib
import subprocess
import sys

_SCRIPTS_DIR = pathlib.Path(__file__).resolve().parent


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
    parser = argparse.ArgumentParser(
        description="Build all components and copy to final destinations.",
    )
    parser.add_argument("--debug", action="store_true", help="Debug build")
    parser.add_argument("--check", action="store_true", help="Check toolchain only")
    args = parser.parse_args()

    if args.check:
        run("build_wasm.py", "--check")
        return

    debug = ["--debug"] if args.debug else []

    # Step 1 — build WASM once
    run("build_wasm.py", *debug)

    # Step 2 — build Python SDK (reuse WASM)
    run("build_python_sdk.py", *debug, "--no-wasm")

    # Step 3 — build JS SDK (reuse WASM)
    run("build_js_sdk.py", *debug, "--no-wasm")

    # Step 4 — copy Python wheel to CLI
    run("build_python_wheel.py", "--skip-wasm")

    print("\n[DONE] Full build and copy complete.")


if __name__ == "__main__":
    main()
