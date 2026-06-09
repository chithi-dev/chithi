/* tslint:disable */
/* eslint-disable */

/**
 * Derive a key using Argon2id.
 * Returns a typed Uint8Array of the derived key bytes.
 */
export function argon2_derive(password: Uint8Array, salt: Uint8Array, iterations: number, memory_cost_kib: number, hash_length: number): Uint8Array;

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
 * Generate a random 32-byte IKM.
 * Returns a typed Uint8Array.
 */
export function generate_ikm(): Uint8Array;

/**
 * Validate that the given bytes are a 7z archive.
 * Returns true if valid, false if not.
 */
export function validate_7z(data: Uint8Array): boolean;
