import struct


def xor_nonce(base: bytes, counter: int) -> bytes:
    """XOR *counter* into the last 4 bytes of *base* to derive a per-block nonce."""
    b = bytearray(base)
    c_bytes = struct.pack("!I", counter)
    for i in range(4):
        b[-(4 - i)] ^= c_bytes[i]
    return bytes(b)
