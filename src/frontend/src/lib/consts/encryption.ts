// Encryption scheme v3 - the single source of truth for the interop contract
// shared with the Python CLI (src/cli/app/helpers/crypto.py).
//
// Pipeline:
//   password  → Argon2id(password, header_salt, t=3, m=64 MiB, p=1) → 32B IKM
//   secret    → 32B random IKM (zero-knowledge path, lives in URL fragment)
//   IKM       → HKDF-SHA256(salt=header_salt, info=HKDF_FILE_INFO) → 32B AES-256 key
//   nonceBase = SHA-256(file_key)[0:12]
//   record i  = AES-256-GCM(plaintext_i, nonce = nonceBase XOR i)
//
// The header salt is REAL: it is fed to both Argon2id (password path) and
// HKDF (all paths), so identical passwords over different uploads yield
// different keys and ciphertexts (no cross-upload rainbow-table reuse).

// Bump on any breaking change to the scheme. Decryption reads this byte and
// dispatches to the matching algorithm.
export const SCHEME_VERSION = 3;

// HKDF domain-separation strings (info field). Salt is the per-file random
// bytes from the header, not a fixed string.
export const HKDF_FILE_INFO = 'chithi-file-key-v3';

// Argon2id parameters (OWASP 2024 minimum for interactive password use).
export const ARGON2_TIME_COST = 3; // iterations
export const ARGON2_MEMORY_COST_KIB = 64 * 1024; // 64 MiB
export const ARGON2_PARALLELISM = 1;
export const ARGON2_HASH_LENGTH = 32; // bytes → IKM

// File-key length: AES-256 (32 bytes).
export const FILE_KEY_LENGTH = 32;

// ECE (RFC 8188) record size: 64 KiB.
export const RECORD_SIZE = 64 * 1024;

// Wire header: [16B random salt][1B version][4B record_size BE] = 21 bytes.
export const SALT_LENGTH = 16;
export const VERSION_LENGTH = 1;
export const RECORD_SIZE_FIELD_LENGTH = 4;
export const HEADER_LENGTH = SALT_LENGTH + VERSION_LENGTH + RECORD_SIZE_FIELD_LENGTH;
export const TAG_LENGTH = 16;
export const NONCE_LENGTH = 12;
