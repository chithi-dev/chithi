CHUNK_SIZE = 64 * 1024  # 64 KiB chunks
GCM_TAG_LEN = 16
ENC_CHUNK_SIZE = CHUNK_SIZE + GCM_TAG_LEN

HKDF_SALT_STR = b"chithi-salt-v1"
HKDF_IV_STR = b"chithi-iv-v1"
AES_KEY_STR = b"aes-key"
