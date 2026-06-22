/* tslint:disable */
/* eslint-disable */

export class WasmKeychain {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Decrypt metadata using ChaCha20-Poly1305.
     */
    decryptMetadata(data: Uint8Array): string;
    /**
     * Encrypt metadata using ChaCha20-Poly1305.
     */
    encryptMetadata(metadata: string): Uint8Array;
    /**
     * Export the auth key (32 bytes).
     */
    exportAuthKey(): Uint8Array;
    /**
     * Create a keychain derived from a password.
     */
    static fromPassword(password: string): WasmKeychain;
    /**
     * Generate a random shared secret (base64-encoded).
     */
    generateSecret(): string;
    /**
     * Get the initial keying material (32 bytes).
     */
    ikm(): Uint8Array;
    /**
     * Create a new keychain with random key material.
     */
    constructor();
    /**
     * Get the salt (32 bytes).
     */
    salt(): Uint8Array;
    /**
     * Re-derive all keys from a new password.
     */
    setPassword(password: string): void;
    /**
     * Sign data with Ed25519.
     */
    sign(data: Uint8Array): Uint8Array;
    /**
     * Verify an Ed25519 signature.
     */
    verify(data: Uint8Array, signature: Uint8Array): boolean;
}

/**
 * Initialize panic hooks so Rust panics appear in the browser console.
 */
export function _init_panic_hook(): void;

/**
 * Compresses multiple entries into a 7z archive in WebAssembly environment.
 *
 * This function creates a compressed archive from multiple file entries,
 * designed specifically for WASM targets.
 *
 * # Arguments
 * * `entries` - Vector of JavaScript strings representing file names/paths
 * * `datas` - Vector of Uint8Arrays containing the file data corresponding to entries
 */
export function compress(entries: string[], datas: Uint8Array[]): Uint8Array;

/**
 * Compress files into a 7z archive with optional AES-256 encryption.
 */
export function compress_7z(names: any[], datas: Uint8Array[], password: string): Uint8Array;

/**
 * Decompresses a 7z archive in WebAssembly environment.
 *
 * This function is specifically designed for WASM targets and uses JavaScript interop
 * to handle the decompression process with a callback function.
 *
 * # Arguments
 * * `src` - Uint8Array containing the compressed archive data
 * * `pwd` - Password string for encrypted archives (use empty string for unencrypted)
 * * `f` - JavaScript callback function to handle extracted entries
 */
export function decompress(src: Uint8Array, pwd: string, f: Function): void;

/**
 * Decompress a 7z archive with optional password.
 * Returns an array of {name, data} objects.
 */
export function decompress_7z(data: Uint8Array, password: string): any[];

/**
 * SDK download: decrypt + decompress bundle back to files.
 * Returns an array of {name, data} objects.
 */
export function download(bundle: Uint8Array, password: string): any[];

/**
 * Download raw data: verify + decrypt JSON-serialized bundle.
 */
export function downloadData(bundle_json: string, password: string): Uint8Array;

/**
 * SDK upload: compress files + encrypt in one call.
 * Returns a Uint8Array bundle containing encrypted data + crypto metadata.
 */
export function upload(names: any[], datas: Uint8Array[], password: string): Uint8Array;

/**
 * Upload raw data: encrypt with password-derived key, return JSON-serialized bundle.
 */
export function uploadData(data: Uint8Array, password: string): string;

/**
 * Validate that the given bytes are a 7z archive.
 */
export function validate_7z(data: Uint8Array): boolean;

/**
 * Derive a key using Argon2id with explicit parameters.
 */
export function wasm_argon2_derive(password: Uint8Array, salt: Uint8Array, iterations: number, memory_cost_kib: number, hash_length: number): Uint8Array;

export function wasm_decrypt_all(records: Uint8Array[], key: Uint8Array): Uint8Array[];

export function wasm_decrypt_chunk(data: Uint8Array, key: Uint8Array, nonce: Uint8Array): Uint8Array;

/**
 * Decrypt multiple chunks using AES-256-GCM.
 */
export function wasm_decrypt_chunks_parallel(chunks: Uint8Array[], key: Uint8Array, base_iv: Uint8Array): Uint8Array[];

export function wasm_decrypt_record(data: Uint8Array, key: Uint8Array): Uint8Array;

/**
 * Derive a 32-byte key from password and salt using Argon2id + HKDF.
 */
export function wasm_derive_key(password: Uint8Array, salt: Uint8Array): Uint8Array;

export function wasm_encrypt_all(records: Uint8Array[], key: Uint8Array): Uint8Array[];

export function wasm_encrypt_chunk(data: Uint8Array, key: Uint8Array, nonce: Uint8Array): Uint8Array;

/**
 * Encrypt multiple chunks using AES-256-GCM.
 * In browser: uses Web Workers via wasm-bindgen-rayon if initialized.
 * In Node.js: uses sequential processing.
 */
export function wasm_encrypt_chunks_parallel(chunks: Uint8Array[], key: Uint8Array, base_iv: Uint8Array): Uint8Array[];

export function wasm_encrypt_record(data: Uint8Array, key: Uint8Array): Uint8Array;

/**
 * Generate a random 32-byte IKM.
 */
export function wasm_generate_ikm(): Uint8Array;

/**
 * Generate a random secret (base64-encoded).
 */
export function wasm_generate_secret(): string;

export function wasm_get_chunk_nonce(base_iv: Uint8Array, chunk_index: number): Uint8Array;
