"""WASM bridge — loads chithi.wasm via wasmtime and exposes Python API."""

import pathlib
import struct
from dataclasses import dataclass
from typing import Sequence

from wasmtime import Engine, Instance, Linker, Module, Store

# Path to the compiled WASM module (bundled with the package).
_WASM_PATH = pathlib.Path(__file__).parent / "chithi.wasm"

# ============================================================================
# Data types
# ============================================================================


@dataclass
class FileEntry:
    name: str
    data: bytes


@dataclass
class EncryptedBundle:
    bytes: bytes


@dataclass
class DownloadResult:
    files: list[FileEntry]


# ============================================================================
# Serialization helpers
# ============================================================================


def _serialize_files(files: list[tuple[str, bytes]]) -> bytes:
    """[num:u32 BE][name_len:u32 BE][name][data_len:u32 BE][data]..."""
    parts: list[bytes] = [struct.pack(">I", len(files))]
    for name, data in files:
        name_bytes = name.encode("utf-8")
        parts.append(struct.pack(">I", len(name_bytes)))
        parts.append(name_bytes)
        parts.append(struct.pack(">I", len(data)))
        parts.append(data)
    return b"".join(parts)


def _deserialize_files(data: bytes) -> list[tuple[str, bytes]]:
    """Reverse of _serialize_files."""
    offset = 0
    num = struct.unpack(">I", data[offset:offset + 4])[0]
    offset += 4
    results: list[tuple[str, bytes]] = []
    for _ in range(num):
        name_len = struct.unpack(">I", data[offset:offset + 4])[0]
        offset += 4
        name = data[offset:offset + name_len].decode("utf-8")
        offset += name_len
        data_len = struct.unpack(">I", data[offset:offset + 4])[0]
        offset += 4
        file_data = data[offset:offset + data_len]
        offset += data_len
        results.append((name, file_data))
    return results


def _serialize_chunks(chunks: list[bytes]) -> bytes:
    """[num:u32 BE][len0:u32 BE][chunk0]..."""
    parts: list[bytes] = [struct.pack(">I", len(chunks))]
    for chunk in chunks:
        parts.append(struct.pack(">I", len(chunk)))
        parts.append(chunk)
    return b"".join(parts)


def _deserialize_chunks(data: bytes) -> list[bytes]:
    """Reverse of _serialize_chunks."""
    offset = 0
    num = struct.unpack(">I", data[offset:offset + 4])[0]
    offset += 4
    results: list[bytes] = []
    for _ in range(num):
        length = struct.unpack(">I", data[offset:offset + 4])[0]
        offset += 4
        results.append(data[offset:offset + length])
        offset += length
    return results


# ============================================================================
# WASM engine — shared across the module
# ============================================================================

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


# ============================================================================
# Public API
# ============================================================================

class Chithi:
    """Main SDK interface for encrypted upload/download."""

    def upload(
        self,
        files: Sequence[tuple[str, bytes]],
        password: str,
    ) -> EncryptedBundle:
        """Compress files into 7z archive and encrypt with password-derived key."""
        inst, store = _ensure()

        if not files:
            raise ValueError("At least one file is required")
        if not password:
            raise ValueError("Password must not be empty")

        serialized = _serialize_files(list(files))
        pwd_bytes = password.encode("utf-8")

        input_ptr = _alloc(store, inst, len(serialized))
        pwd_ptr = _alloc(store, inst, len(pwd_bytes))
        out_ptr = _alloc(store, inst, len(serialized) * 4)
        out_len_ptr = _alloc(store, inst, 4)

        _write_bytes(store, inst, input_ptr, serialized)
        _write_bytes(store, inst, pwd_ptr, pwd_bytes)

        fn = inst.exports.get_function("wasm_upload")
        status = fn(
            store, input_ptr, len(serialized),
            pwd_ptr, len(pwd_bytes),
            out_ptr, out_len_ptr,
            0, 0,  # callback_fn, user_data
        )

        if status != 0:
            _dealloc(store, inst, input_ptr, len(serialized))
            _dealloc(store, inst, out_ptr, len(serialized) * 4)
            _dealloc(store, inst, out_len_ptr, 4)
            raise RuntimeError(f"Upload failed with status {status}")

        out_len = _read_u32(store, inst, out_len_ptr)
        bundle_data = _read_bytes(store, inst, out_ptr, out_len)

        _dealloc(store, inst, input_ptr, len(serialized))
        _dealloc(store, inst, pwd_ptr, len(pwd_bytes))
        _dealloc(store, inst, out_ptr, out_len)
        _dealloc(store, inst, out_len_ptr, 4)

        return EncryptedBundle(bytes=bundle_data)

    def download(
        self,
        bundle: EncryptedBundle | bytes,
        password: str,
    ) -> DownloadResult:
        """Decrypt and decompress an encrypted bundle back to files."""
        inst, store = _ensure()

        if isinstance(bundle, EncryptedBundle):
            bundle_bytes = bundle.bytes
        else:
            bundle_bytes = bundle

        if not password:
            raise ValueError("Password must not be empty")

        pwd_bytes = password.encode("utf-8")

        bundle_ptr = _alloc(store, inst, len(bundle_bytes))
        pwd_ptr = _alloc(store, inst, len(pwd_bytes))
        out_ptr = _alloc(store, inst, len(bundle_bytes) * 2)
        out_len_ptr = _alloc(store, inst, 4)

        _write_bytes(store, inst, bundle_ptr, bundle_bytes)
        _write_bytes(store, inst, pwd_ptr, pwd_bytes)

        fn = inst.exports.get_function("wasm_download")
        status = fn(
            store, bundle_ptr, len(bundle_bytes),
            pwd_ptr, len(pwd_bytes),
            out_ptr, out_len_ptr,
            0, 0,
        )

        if status != 0:
            _dealloc(store, inst, bundle_ptr, len(bundle_bytes))
            _dealloc(store, inst, out_ptr, len(bundle_bytes) * 2)
            _dealloc(store, inst, out_len_ptr, 4)
            raise RuntimeError(f"Download failed with status {status}")

        out_len = _read_u32(store, inst, out_len_ptr)
        result_data = _read_bytes(store, inst, out_ptr, out_len)
        files = _deserialize_files(result_data)

        _dealloc(store, inst, bundle_ptr, len(bundle_bytes))
        _dealloc(store, inst, pwd_ptr, len(pwd_bytes))
        _dealloc(store, inst, out_ptr, out_len)
        _dealloc(store, inst, out_len_ptr, 4)

        return DownloadResult(files=[FileEntry(name=n, data=d) for n, d in files])
