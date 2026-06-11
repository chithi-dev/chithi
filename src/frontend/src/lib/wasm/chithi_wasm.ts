import init, {
    type InitInput,
    compress_7z,
    decompress_7z,
    validate_7z,
    wasm_encrypt_chunk,
    wasm_decrypt_chunk,
    wasm_get_chunk_nonce,
    wasm_derive_key,
    WasmKeychain
} from './wasm_binding.js';

import { argon2_derive, generate_ikm } from './chithi_core.js';

let initialized = false;
let initPromise: Promise<void> | null = null;

export async function ensureInitialized(): Promise<void> {
    if (initialized) return;
    if (initPromise) return initPromise;
    initPromise = init().then(() => { initialized = true; }).finally(() => { initPromise = null; });
    return initPromise;
}

export interface SevenEntry {
    name: string;
    data: Uint8Array;
}

export function compress7z(entries: { name: string; data: Uint8Array }[], password?: string): Uint8Array {
    return compress_7z(
        entries.map(e => e.name),
        entries.map(e => e.data),
        password ?? ''
    );
}

export function decompress7z(data: Uint8Array, password?: string): Promise<SevenEntry[]> {
    return new Promise((resolve, reject) => {
        try {
            const entries: SevenEntry[] = [];
            decompress_7z(data, password ?? '', (name: string, entryData: Uint8Array) => {
                entries.push({ name, data: entryData });
            });
            resolve(entries);
        } catch (e) {
            reject(e);
        }
    });
}

export function validate7z(data: Uint8Array): boolean {
    return validate_7z(data);
}

// Crypto exports
export const argon2DeriveWasm = argon2_derive;
export const generateIkmWasm = generate_ikm;
export const wasmEncryptChunk = wasm_encrypt_chunk;
export const wasmDecryptChunk = wasm_decrypt_chunk;
export const wasmGetChunkNonce = wasm_get_chunk_nonce;
export const wasmDeriveKey = wasm_derive_key;
export { WasmKeychain };
