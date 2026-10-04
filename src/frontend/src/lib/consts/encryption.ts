// Deterministic derivation constants for the Web Crypto pipeline.
// The full scheme: random 128-bit secret (or PBKDF2(password)) → HKDF-SHA-256
// → AES-128-GCM file key + HMAC-SHA-256 auth key. Secret lives only in the
// URL hash fragment and never reaches the server.
export const HKDF_SALT_STR = 'chithi-salt-v2';
export const HKDF_FILE_INFO = 'chithi-file-key-v2';
export const HKDF_AUTH_INFO = 'chithi-auth-key-v2';

// PBKDF2 parameters for password → IKM. 100k iterations is the OWASP 2023
// minimum for PBKDF2-SHA-256 and is fast enough on modern hardware (<50ms).
export const PBKDF2_ITERATIONS = 100_000;

// ECE (RFC 8188) record size: 64 KiB, matching Mozilla Send.
export const RECORD_SIZE = 64 * 1024;

// Wire format: 16-byte random salt + 4-byte record size (BE) = 20-byte header,
// followed by concatenated records. Each record = AES-128-GCM ciphertext
// (plaintext + 16-byte auth tag).
export const SALT_LENGTH = 16;
export const RECORD_SIZE_FIELD_LENGTH = 4;
export const HEADER_LENGTH = SALT_LENGTH + RECORD_SIZE_FIELD_LENGTH;
export const TAG_LENGTH = 16;
export const NONCE_LENGTH = 12;
