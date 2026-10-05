import * as argon2 from 'argon2-browser';
import {
	ARGON2_HASH_LENGTH,
	ARGON2_MEMORY_COST_KIB,
	ARGON2_PARALLELISM,
	ARGON2_TIME_COST,
	FILE_KEY_LENGTH,
	HKDF_FILE_INFO,
} from '#consts/encryption';

const encoder = new TextEncoder();

// TS 6's typed-array generics make Uint8Array<ArrayBufferLike> reject against
// the Web Crypto BufferSource parameter. Slice the exact byte range into a
// fresh ArrayBuffer-backed view to satisfy the type and avoid the mismatch.
function asBufferSource(u8: Uint8Array): ArrayBuffer {
	return u8.slice().buffer;
}

// ---------------------------------------------------------------------------
// Base64 / base64url helpers (URL-fragment transport of the secret key).
// ---------------------------------------------------------------------------

export function bytesToBase64(u8: Uint8Array) {
	let binary = '';
	for (let i = 0; i < u8.byteLength; i++) binary += String.fromCharCode(u8[i]);
	return btoa(binary);
}

export function base64ToBytes(b64: string) {
	const raw = atob(b64);
	const bytes = new Uint8Array(raw.length);
	for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
	return bytes;
}

export function base64url(u8: Uint8Array) {
	return bytesToBase64(u8).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64urlToBytes(str: string) {
	let b64 = str.replace(/-/g, '+').replace(/_/g, '/');
	while (b64.length % 4) b64 += '=';
	return base64ToBytes(b64);
}

// ---------------------------------------------------------------------------
// Key material
// ---------------------------------------------------------------------------

/** Generate a fresh random 32-byte secret (zero-knowledge root, URL fragment). */
export function generateSecret(): Uint8Array {
	return crypto.getRandomValues(new Uint8Array(ARGON2_HASH_LENGTH));
}

/**
 * Argon2id(password, salt) → 32-byte IKM.
 * The per-file salt comes from the ciphertext header, so the same password
 * over different uploads derives different IKMs.
 */
export async function passwordToIkM(password: string, salt: Uint8Array): Promise<Uint8Array> {
	const result = await argon2.hash({
		pass: password,
		salt,
		time: ARGON2_TIME_COST,
		mem: ARGON2_MEMORY_COST_KIB,
		parallelism: ARGON2_PARALLELISM,
		hashLen: ARGON2_HASH_LENGTH,
		type: argon2.ArgonType.Argon2id,
	});
	if (!result.hash) throw new Error('Argon2id derivation failed');
	return result.hash;
}

/**
 * HKDF-SHA256(IKM, salt, info) → 32-byte AES-256 file key (extractable, so
 * the worker can derive the deterministic nonceBase = SHA-256(key)[0:12]).
 */
export async function deriveFileKey(ikm: Uint8Array, salt: Uint8Array): Promise<CryptoKey> {
	const hkdfBase = await crypto.subtle.importKey('raw', asBufferSource(ikm), 'HKDF', false, ['deriveKey']);
	return crypto.subtle.deriveKey(
		{ name: 'HKDF', hash: 'SHA-256', salt: asBufferSource(salt), info: asBufferSource(encoder.encode(HKDF_FILE_INFO)) },
		hkdfBase,
		{ name: 'AES-GCM', length: FILE_KEY_LENGTH * 8 },
		true,
		['encrypt', 'decrypt'],
	);
}

/**
 * Resolve an IKM. If a password is given, Argon2id it against the salt.
 * Otherwise use the caller-supplied secret as-is (already 32 bytes).
 */
export async function resolveIkM(
	secret: Uint8Array | null,
	password: string | null,
	salt: Uint8Array,
): Promise<Uint8Array> {
	if (password) return passwordToIkM(password, salt);
	if (secret) return secret;
	return generateSecret();
}

/**
 * Derive the deterministic 12-byte nonce base from a file key:
 * SHA-256(rawKey)[0:12]. Shared by encrypt and decrypt directions.
 */
export async function computeNonceBase(fileKey: CryptoKey): Promise<Uint8Array> {
	const raw = new Uint8Array(await crypto.subtle.exportKey('raw', fileKey));
	const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', raw));
	return digest.slice(0, 12);
}
