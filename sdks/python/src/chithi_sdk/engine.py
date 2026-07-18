"""WASM engine — loads chithi.wasm via wasmtime and provides memory helpers."""

import pathlib
import struct

from wasmtime import Engine, Instance, Linker, Module, Store

# Path to the compiled WASM module (bundled with the package).
_WASM_PATH = pathlib.Path(__file__).parent / "chithi.wasm"

_engine = Engine()
_linker = Linker(_engine)
_instance: Instance | None = None
_store: Store | None = None


def _ensure() -> tuple[Instance, Store]:
    """Lazy-load the WASM module."""
    global _instance, _store
    if _instance is None:
        if not _WASM_PATH.exists():
            raise FileNotFoundError(
                f"WASM module not found at {_WASM_PATH}. "
                "Run 'python scripts/build_wasm.py' to build it."
            )
        module = Module.from_file(_engine, str(_WASM_PATH))
        _store = Store(_engine)
        _instance = _linker.instantiate(_store, module)
    return _instance, _store


def _alloc(store: Store, instance: Instance, length: int) -> int:
    """Allocate memory in WASM linear memory."""
    return instance.exports.get_function("chithi_alloc")(store, length)


def _dealloc(store: Store, instance: Instance, ptr: int, length: int) -> None:
    """Free memory in WASM linear memory."""
    instance.exports.get_function("chithi_dealloc")(store, ptr, length)


def _write_bytes(store: Store, instance: Instance, ptr: int, data: bytes) -> None:
    """Write bytes to WASM linear memory."""
    memory = instance.exports.get_memory("memory")
    data_view = memory.data_ptr(store)
    for i, b in enumerate(data):
        data_view[ptr + i] = b


def _read_bytes(store: Store, instance: Instance, ptr: int, length: int) -> bytes:
    """Read bytes from WASM linear memory."""
    memory = instance.exports.get_memory("memory")
    data_view = memory.data_ptr(store)
    return bytes(data_view[ptr:ptr + length])


def _read_u32(store: Store, instance: Instance, ptr: int) -> int:
    """Read a u32 from WASM linear memory (little-endian)."""
    data = _read_bytes(store, instance, ptr, 4)
    return struct.unpack("<I", data)[0]
