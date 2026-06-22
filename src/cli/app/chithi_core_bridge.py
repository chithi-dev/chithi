"""Bridge to the native chithi_core Rust module.

This module imports the compiled PyO3 extension. The extension is built
by maturin from core/crates/python_bindings/.
"""

try:
    import chithi_core  # type: ignore
except ImportError as e:
    raise ImportError(
        "Cannot import chithi_core native module. "
        "Ensure the Rust extension is compiled: "
        "  maturin develop"
    ) from e

__all__ = ["chithi_core"]
