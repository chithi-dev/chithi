"""Public API — Chithi client for encrypted upload/download."""

from collections.abc import Sequence

from .engine import _alloc, _dealloc, _ensure, _read_bytes, _read_u32, _write_bytes
from .serialize import _deserialize_files, _serialize_files
from .types import DownloadResult, EncryptedBundle, FileEntry


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
            store,
            input_ptr,
            len(serialized),
            pwd_ptr,
            len(pwd_bytes),
            out_ptr,
            out_len_ptr,
            0,
            0,  # callback_fn, user_data
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
            store,
            bundle_ptr,
            len(bundle_bytes),
            pwd_ptr,
            len(pwd_bytes),
            out_ptr,
            out_len_ptr,
            0,
            0,
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
