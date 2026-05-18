from typing import Final

CHUNK_SIZE: Final[int] = 64 * 1024  # 64 KiB chunks
GCM_TAG_LEN: Final[int] = 16
ENC_CHUNK_SIZE: Final[int] = CHUNK_SIZE + GCM_TAG_LEN

HKDF_SALT_STR: Final[bytes] = b"chithi-salt-v1"
HKDF_IV_STR: Final[bytes] = b"chithi-iv-v1"
AES_KEY_STR: Final[bytes] = b"aes-key"
