"""Bridge to the chithi WASM module via wasmtime.

The WASM module is built by scripts/build_wasm.py and installed
by scripts/build_python_wheel.py. It provides all crypto and
compression functions through a wasmtime-based Python bridge.
"""

try:
    from chithi_sdk import Chithi, FileEntry, EncryptedBundle, DownloadResult  # type: ignore
except ImportError as e:
    raise ImportError(
        "Cannot import chithi_sdk. "
        "Ensure the WASM module is built and installed:\n"
        "  python scripts/build_all.py"
    ) from e

__all__ = ["Chithi", "FileEntry", "EncryptedBundle", "DownloadResult"]
