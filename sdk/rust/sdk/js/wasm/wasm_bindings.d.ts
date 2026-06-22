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

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_wasmkeychain_free: (a: number, b: number) => void;
    readonly downloadData: (a: number, b: number, c: number, d: number) => [number, number, number];
    readonly uploadData: (a: number, b: number, c: number, d: number) => [number, number, number, number];
    readonly wasm_argon2_derive: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => [number, number, number];
    readonly wasm_decrypt_all: (a: number, b: number, c: number, d: number) => [number, number, number, number];
    readonly wasm_decrypt_chunk: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number, number];
    readonly wasm_decrypt_chunks_parallel: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number, number, number];
    readonly wasm_decrypt_record: (a: number, b: number, c: number, d: number) => [number, number, number];
    readonly wasm_derive_key: (a: number, b: number, c: number, d: number) => [number, number, number];
    readonly wasm_encrypt_all: (a: number, b: number, c: number, d: number) => [number, number, number, number];
    readonly wasm_encrypt_chunk: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number, number];
    readonly wasm_encrypt_chunks_parallel: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number, number, number];
    readonly wasm_encrypt_record: (a: number, b: number, c: number, d: number) => [number, number, number];
    readonly wasm_generate_ikm: () => any;
    readonly wasm_generate_secret: () => [number, number];
    readonly wasm_get_chunk_nonce: (a: number, b: number, c: number) => any;
    readonly wasmkeychain_decryptMetadata: (a: number, b: number, c: number) => [number, number, number, number];
    readonly wasmkeychain_encryptMetadata: (a: number, b: number, c: number) => [number, number, number];
    readonly wasmkeychain_exportAuthKey: (a: number) => any;
    readonly wasmkeychain_fromPassword: (a: number, b: number) => [number, number, number];
    readonly wasmkeychain_generateSecret: (a: number) => [number, number];
    readonly wasmkeychain_ikm: (a: number) => any;
    readonly wasmkeychain_new: () => number;
    readonly wasmkeychain_salt: (a: number) => any;
    readonly wasmkeychain_setPassword: (a: number, b: number, c: number) => [number, number];
    readonly wasmkeychain_sign: (a: number, b: number, c: number) => any;
    readonly wasmkeychain_verify: (a: number, b: number, c: number, d: number, e: number) => number;
    readonly compress_7z: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number, number];
    readonly decompress_7z: (a: number, b: number, c: number, d: number) => [number, number, number, number];
    readonly download: (a: number, b: number, c: number, d: number) => [number, number, number, number];
    readonly upload: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number, number];
    readonly validate_7z: (a: number, b: number) => number;
    readonly _init_panic_hook: () => void;
    readonly compress: (a: number, b: number, c: number, d: number) => [number, number, number];
    readonly decompress: (a: any, b: number, c: number, d: any) => [number, number];
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_exn_store: (a: number) => void;
    readonly __externref_table_alloc: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __externref_drop_slice: (a: number, b: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
