import {
	DEFAULT_ARGON2_ITERATIONS,
	DEFAULT_ARGON2_MEMORY_KIB,
	MAX_ARGON2_MEMORY_KIB
} from '#consts/encryption';

// #region Base64 / Base64url

export function bytesToBase64(bytes: Uint8Array): string {
	return btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(''));
}

export function base64ToBytes(b64: string): Uint8Array {
	return Uint8Array.from(b64, (c) => c.charCodeAt(0));
}

const base64urlSafe = (b64: string) =>
	b64.replaceAll('+', '-').replaceAll('/', '_').replaceAll(/=+$/, '');

export function base64url(bytes: Uint8Array): string {
	return base64urlSafe(bytesToBase64(bytes));
}

export function base64urlToBytes(str: string): Uint8Array {
	const padded = str.replaceAll('-', '+').replaceAll('_', '/');
	return base64ToBytes(padded.padEnd(padded.length + (4 - (padded.length % 4)) % 4, '='));
}

// #endregion

// #region Byte utilities

export function xorBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
	const len = Math.max(a.length, b.length);
	const out = new Uint8Array(len);
	for (let i = 0; i < len; i++) {
		out[i] = (a[i] ?? 0) ^ (b[i] ?? 0);
	}
	return out;
}

// #endregion

// #region Key derivation

/** Derive an AES-256-GCM crypto key from IKM using Argon2id. */
export async function deriveAESKeyFromIKM(ikm: Uint8Array, salt: Uint8Array) {
	const rawKey = await argon2Derive(ikm, salt);
	return crypto.subtle.importKey('raw', rawKey as unknown as ArrayBuffer, 'AES-GCM', true, [
		'encrypt',
		'decrypt'
	]);
}

/** Argon2id key derivation with memory-capped parameters. */
export async function argon2Derive(
	password: string | Uint8Array,
	salt: Uint8Array,
	iterations = DEFAULT_ARGON2_ITERATIONS,
	memoryKib = DEFAULT_ARGON2_MEMORY_KIB,
	hashLength = 32,
	parallelism = 1
) {
	const { argon2id } = await import('hash-wasm');
	return argon2id({
		password,
		salt,
		iterations,
		memorySize: Math.min(memoryKib, MAX_ARGON2_MEMORY_KIB),
		hashLength,
		parallelism,
		outputType: 'binary'
	});
}

// #endregion

// #region Chunked encryption helpers

export type InnerEncryptionMeta = {
	cipher: 'AES-GCM';
	hkdf: { hash: 'SHA-512'; salt: string };
	iv: string;
	size?: number;
};

export const CHUNK_SIZE = 64 * 1024; // 64 KB

/** Derive a per-chunk IV by XOR-ing the chunk index into the last 4 bytes. */
export function getChunkIv(baseIv: Uint8Array, chunkIndex: number): Uint8Array {
	const iv = baseIv.slice();
	const view = new DataView(iv.buffer, iv.byteOffset, iv.byteLength);
	view.setUint32(8, view.getUint32(8, false) ^ chunkIndex, false);
	return iv;
}

// #endregion
