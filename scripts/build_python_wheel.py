"""Build the chithi-sdk Python wheel and install to the CLI directory.

Usage:
    python scripts/build_python_wheel.py            # Build + install
    python scripts/build_python_wheel.py --develop  # pip install -e for dev
"""

import argparse
import shutil
import subprocess
import sys

_PYTHON_BINDING_DIR = __file__.resolve().parent.parent / "bindings" / "python"
_CLI_DIR = __file__.resolve().parent.parent / "src" / "cli"


def find_python() -> str:
    """Find the Python interpreter."""
    return sys.executable


def build_wasm_first() -> None:
    """Ensure the WASM module is built before building the wheel."""
    scripts_dir = __file__.resolve().parent
    build_wasm = scripts_dir / "build_wasm.py"

    if build_wasm.exists():
        print("[WASM] Building WASM module first...")
        subprocess.run(
            [find_python(), str(build_wasm), "--no-deploy"],
            check=True,
        )
        # Now deploy to Python binding dir
        subprocess.run(
            [find_python(), str(build_wasm)],
            check=True,
        )
    else:
        print("[WARN] build_wasm.py not found. Ensure WASM is built manually.")


def build_wheel() -> pathlib.Path | None:
    """Build the Python wheel using hatch/pip."""
    python = find_python()
    binding_dir = _PYTHON_BINDING_DIR

    print(f"[BUILD] Building Python wheel from {binding_dir}")

    # Try hatch first, fall back to pip wheel
    if shutil.which("hatch"):
        cmd = ["hatch", "build", "--target", "wheel", "-d", str(binding_dir / "dist")]
    else:
        cmd = [python, "-m", "pip", "wheel", "--no-deps", "-w", str(binding_dir / "dist"), str(binding_dir)]

    try:
        subprocess.run(cmd, check=True)
    except subprocess.CalledProcessError as e:
        print(f"[ERROR] Wheel build failed: {e}")
        return None

    # Find the .whl file
    dist_dir = binding_dir / "dist"
    wheels = list(dist_dir.glob("*.whl"))
    if wheels:
        print(f"[OK] Built wheel: {wheels[-1].name}")
        return wheels[-1]
    print("[WARN] No wheel found in dist/")
    return None


def install_wheel(wheel_path: pathlib.Path) -> None:
    """Install the wheel into the CLI's Python environment."""
    python = find_python()

    print(f"[INSTALL] Installing wheel to CLI environment...")

    cmd = [python, "-m", "pip", "install", "--force-reinstall", str(wheel_path)]
    try:
        subprocess.run(cmd, check=True)
    except subprocess.CalledProcessError as e:
        print(f"[ERROR] Wheel installation failed: {e}")
        sys.exit(1)

    print("[OK] Wheel installed.")


def install_develop() -> None:
    """Install the Python binding in development mode."""
    python = find_python()
    binding_dir = _PYTHON_BINDING_DIR

    print(f"[DEV] Installing in development mode from {binding_dir}")

    cmd = [python, "-m", "pip", "install", "-e", str(binding_dir)]
    try:
        subprocess.run(cmd, check=True)
    except subprocess.CalledProcessError as e:
        print(f"[ERROR] Dev install failed: {e}")
        sys.exit(1)

    print("[OK] Dev install complete.")


def main() -> None:
    import pathlib

    parser = argparse.ArgumentParser(description="Build chithi-sdk Python wheel")
    parser.add_argument(
        "--develop", action="store_true",
        help="Install in development mode (pip install -e)",
    )
    parser.add_argument(
        "--skip-wasm", action="store_true",
        help="Skip building the WASM module (assume it's already built)",
    )
    args = parser.parse_args()

    if args.develop:
        if not args.skip_wasm:
            build_wasm_first()
        install_develop()
        return

    # Default: build wheel + install
    if not args.skip_wasm:
        build_wasm_first()

    wheel = build_wheel()
    if wheel:
        install_wheel(wheel)
    else:
        print("[WARN] Wheel build failed, trying dev install as fallback...")
        install_develop()


if __name__ == "__main__":
    main()
