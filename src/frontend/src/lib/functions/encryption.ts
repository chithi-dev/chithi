import { argon2id } from 'hash-wasm';

export function bytesToBase64(u8: Uint8Array) {
	let binary = '';
	for (let i = 0; i < u8.byteLength; i++) {
		binary += String.fromCharCode(u8[i]);
	}
	return btoa(binary);
}

export function base64ToBytes(b64: string) {
	const binary = atob(b64);
	const len = binary.length;
	const bytes = new Uint8Array(len);
	for (let i = 0; i < len; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
}

export function base64url(u8: Uint8Array) {
	return bytesToBase64(u8).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64urlToBytes(str: string) {
	let b64 = str.replace(/-/g, '+').replace(/_/g, '/');
	while (b64.length % 4) {
		b64 += '=';
	}
	return base64ToBytes(b64);
}

export function xorBytes(a: Uint8Array, b: Uint8Array) {
	const out = new Uint8Array(Math.max(a.length, b.length));
	for (let i = 0; i < out.length; i++) {
		out[i] = (a[i] || 0) ^ (b[i] || 0);
	}
	return out;
}

// Derive AES-256-GCM key from ikm using Argon2id
export async function deriveAESKeyFromIKM(
	ikm: Uint8Array,
	hkdfSalt: Uint8Array,
	info?: Uint8Array
) {
	const derivedBits = await argon2Derive(ikm, hkdfSalt, 1, 1024, 32, 1);
	return await crypto.subtle.importKey('raw', derivedBits as any, { name: 'AES-GCM' }, false, [
		'encrypt',
		'decrypt'
	]);
}

export async function argon2Derive(
	password: string | Uint8Array,
	salt: Uint8Array,
	iterations: number,
	memorySize = 16384,
	hashLength = 32,
	parallelism = 1
) {
	return await argon2id({
		password,
		salt,
		iterations,
		memorySize,
		hashLength,
		parallelism,
		outputType: 'binary'
	});
}

export type InnerEncryptionMeta = {
	cipher: 'AES-GCM';
	hkdf: { hash: 'SHA-512'; salt: string };
	iv: string;
	size?: number;
};

export const CHUNK_SIZE = 64 * 1024; // 64KB

export function getChunkIv(baseIv: Uint8Array, chunkIndex: number): Uint8Array {
	const iv = new Uint8Array(baseIv);
	const view = new DataView(iv.buffer, iv.byteOffset, iv.byteLength);
	// XOR the chunk index into the last 4 bytes (big-endian)
	const last4 = view.getUint32(8, false);
	view.setUint32(8, last4 ^ chunkIndex, false);
	return iv;
}
