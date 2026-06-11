/* tslint:disable */
/* eslint-disable */

export class WasmKeychain {
    free(): void;
    [Symbol.dispose](): void;
    decryptMetadata(data: Uint8Array): string;
    encryptMetadata(metadata: string): Uint8Array;
    exportAuthKey(): Uint8Array;
    static fromPassword(password: string): WasmKeychain;
    generateSecret(): string;
    ikm(): Uint8Array;
    constructor();
    salt(): Uint8Array;
    setPassword(password: string): void;
    sign(data: Uint8Array): Uint8Array;
    verify(data: Uint8Array, signature: Uint8Array): boolean;
}

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
 * Decompress a 7z archive with optional password for encrypted archives.
 * Calls the callback for each entry with (name, data, type).
 */
export function decompress_7z(data: Uint8Array, password: string, callback: Function): void;

/**
 * Validate that the given bytes are a 7z archive.
 */
export function validate_7z(data: Uint8Array): boolean;

export function wasm_decrypt_chunk(data: Uint8Array, key: Uint8Array, nonce: Uint8Array): Uint8Array;

export function wasm_decrypt_record(data: Uint8Array, key: Uint8Array): Uint8Array;

export function wasm_derive_key(password: Uint8Array, salt: Uint8Array): Uint8Array;

export function wasm_encrypt_chunk(data: Uint8Array, key: Uint8Array, nonce: Uint8Array): Uint8Array;

export function wasm_encrypt_record(data: Uint8Array, key: Uint8Array): Uint8Array;

export function wasm_generate_secret(): string;

export function wasm_get_chunk_nonce(base_iv: Uint8Array, chunk_index: number): Uint8Array;
