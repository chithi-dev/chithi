"""Serialization helpers for WASM C ABI wire format."""

import struct


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
