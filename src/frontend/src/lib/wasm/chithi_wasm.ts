import init, {
	type InitInput,
	compress_7z,
	decompress_7z,
	validate_7z,
	wasm_encrypt_chunk,
	wasm_decrypt_chunk,
	wasm_get_chunk_nonce,
	wasm_derive_key,
	wasm_argon2_derive,
	wasm_generate_ikm,
	wasm_generate_secret,
	WasmKeychain,
	wasm_encrypt_chunks_parallel,
	wasm_decrypt_chunks_parallel,
	wasm_encrypt_all,
	wasm_decrypt_all,
	upload,
	download,
	uploadData,
	downloadData
} from './wasm_bindings.js';

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
			const result = decompress_7z(data, password ?? '');
			const entries: SevenEntry[] = result.map((e: any) => ({
				name: e.name,
				data: new Uint8Array(e.data)
			}));
			resolve(entries);
		} catch (e) {
			reject(e);
		}
	});
}

export function validate7z(data: Uint8Array): boolean {
	return validate_7z(data);
}

// Crypto exports — unified SDK
export const argon2DeriveWasm = wasm_argon2_derive;
export const generateIkmWasm = wasm_generate_ikm;
export const wasmEncryptChunk = wasm_encrypt_chunk;
export const wasmDecryptChunk = wasm_decrypt_chunk;
export const wasmGetChunkNonce = wasm_get_chunk_nonce;
export const wasmDeriveKey = wasm_derive_key;
export const wasmEncryptChunksParallel = wasm_encrypt_chunks_parallel;
export const wasmDecryptChunksParallel = wasm_decrypt_chunks_parallel;
export const wasmEncryptAll = wasm_encrypt_all;
export const wasmDecryptAll = wasm_decrypt_all;

// SDK-level exports
export { upload, download, uploadData, downloadData, WasmKeychain };
