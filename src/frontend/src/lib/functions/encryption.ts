import {
	HKDF_AUTH_INFO,
	HKDF_FILE_INFO,
	HKDF_SALT_STR,
	PBKDF2_ITERATIONS,
} from '#consts/encryption';

const encoder = new TextEncoder();

/**
 * Base64 helpers (kept for URL-fragment transport of the secret key).
 */
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

export function xorBytes(a: Uint8Array, b: Uint8Array) {
	const out = new Uint8Array(Math.max(a.length, b.length));
	for (let i = 0; i < out.length; i++) out[i] = (a[i] || 0) ^ (b[i] || 0);
	return out;
}

/**
 * Derive the 128-bit IKM from a password using PBKDF2-SHA-256.
 * The salt is fixed (HKDF_SALT_STR) so the same password always yields the
 * same IKM — the secret key is *derived* from the password, not random.
 */
export async function passwordToIkM(password: string): Promise<Uint8Array> {
	const keyMaterial = await crypto.subtle.importKey(
		'raw',
		encoder.encode(password),
		{ name: 'PBKDF2' },
		false,
		['deriveBits'],
	);
	const bits = await crypto.subtle.deriveBits(
		{ name: 'PBKDF2', salt: encoder.encode(HKDF_SALT_STR), iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
		keyMaterial,
		128,
	);
	return new Uint8Array(bits);
}

/**
 * Derive the file-content AES-128-GCM key and the HMAC-SHA-256 auth key
 * from an IKM using HKDF-SHA-256. Mirrors Mozilla Send's keychain: one
 * secret, two derived keys (content + auth).
 */
export async function deriveKeys(ikm: Uint8Array): Promise<{
	fileKey: CryptoKey;
	authKey: CryptoKey;
}> {
	const hkdfBase = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveKey']);
	const hkdfSalt = encoder.encode(HKDF_SALT_STR);

	// extractable: true so the worker can export the raw bytes to compute a
	// deterministic nonceBase (SHA-256 of the raw key) shared by both
	// encrypt and decrypt directions.
	const fileKey = await crypto.subtle.deriveKey(
		{ name: 'HKDF', hash: 'SHA-256', salt: hkdfSalt, info: encoder.encode(HKDF_FILE_INFO) },
		hkdfBase,
		{ name: 'AES-GCM', length: 128 },
		true,
		['encrypt', 'decrypt'],
	);

	const authKey = await crypto.subtle.deriveKey(
		{ name: 'HKDF', hash: 'SHA-256', salt: hkdfSalt, info: encoder.encode(HKDF_AUTH_INFO) },
		hkdfBase,
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign', 'verify'],
	);

	return { fileKey, authKey };
}

/**
 * Generate a fresh random 128-bit secret (the "keySecret" embedded in the
 * share URL fragment). This is the zero-knowledge root: the server never
 * sees it, only the ciphertext and the URL hash.
 */
export function generateSecret(): Uint8Array {
	return crypto.getRandomValues(new Uint8Array(16));
}

/**
 * Resolve an IKM from either a raw secret or a password. When a password is
 * provided, the IKM is *derived* from it (deterministic), otherwise the
 * caller-supplied secret is used as-is.
 */
export async function resolveIkM(secret: Uint8Array | null, password: string | null): Promise<Uint8Array> {
	if (password) {
		return passwordToIkM(password);
	}
	if (secret) {
		return secret;
	}
	return generateSecret();
}
