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

export function xorBytes(a: Uint8Array, b: Uint8Array) {
	const out = new Uint8Array(Math.max(a.length, b.length));
	for (let i = 0; i < out.length; i++) {
		out[i] = (a[i] || 0) ^ (b[i] || 0);
	}
	return out;
}

// Derive AES-256-GCM key from ikm using HKDF-SHA-512
function toArrayBuffer(u8: Uint8Array) {
	return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
}

export async function deriveAESKeyFromIKM(
	ikm: Uint8Array,
	hkdfSalt: Uint8Array,
	info?: Uint8Array
) {
	const baseKey = await crypto.subtle.importKey('raw', toArrayBuffer(ikm) as any, 'HKDF', false, [
		'deriveKey'
	]);
	const key = await crypto.subtle.deriveKey(
		{
			name: 'HKDF',
			hash: 'SHA-512',
			salt: toArrayBuffer(hkdfSalt) as any,
			info: toArrayBuffer(info || new Uint8Array([])) as any
		},
		baseKey,
		{ name: 'AES-GCM', length: 256 },
		false,
		['encrypt', 'decrypt']
	);
	return key;
}

// PBKDF2 derive raw bytes (used for optional password mixing)
export async function pbkdf2Derive(
	password: string,
	salt: Uint8Array,
	iterations: number,
	lengthBytes = 32
) {
	const enc = new TextEncoder();
	const pwKey = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, [
		'deriveBits'
	]);
	const bits = await crypto.subtle.deriveBits(
		{
			name: 'PBKDF2',
			hash: 'SHA-512',
			salt: toArrayBuffer(salt) as any,
			iterations
		},
		pwKey,
		lengthBytes * 8
	);
	return new Uint8Array(bits);
}

// Encrypt a blob (tar or gz) using AES-256-GCM with HKDF-SHA-256 derived key.
// If password is provided, the derived PBKDF2 bytes are xor'ed with the random ikm before HKDF.
export type EncryptionMeta = {
	cipher: 'AES-GCM';
	hkdf: { hash: 'SHA-512'; salt: string };
	iv: string;
	pbkdf2?: { salt: string; iterations: number };
};

export async function encryptBlobWithHKDF(
	blob: Blob,
	password?: string
): Promise<{ ciphertext: Blob; meta: EncryptionMeta; keySecret: string }> {
	// ikm (random secret) — reveal in URL fragment (base64url)
	const ikm = crypto.getRandomValues(new Uint8Array(32));
	const hkdfSalt = crypto.getRandomValues(new Uint8Array(16));
	let finalIKM = ikm;
	const meta: EncryptionMeta = {
		cipher: 'AES-GCM',
		hkdf: { hash: 'SHA-512', salt: bytesToBase64(hkdfSalt) },
		iv: ''
	};

	if (password && password.length > 0) {
		const iterations = 150_000; // recommended >= 100k
		const pbkdf2Salt = crypto.getRandomValues(new Uint8Array(16));
		const pb = await pbkdf2Derive(password, pbkdf2Salt, iterations, 32);
		finalIKM = xorBytes(ikm, pb);
		meta.pbkdf2 = { salt: bytesToBase64(pbkdf2Salt), iterations };
	}

	// Derive AES key
	const aesKey = await deriveAESKeyFromIKM(finalIKM, hkdfSalt);

	// Encrypt
	const iv = crypto.getRandomValues(new Uint8Array(12));
	meta.iv = bytesToBase64(iv);

	const plaintext = new Uint8Array(await blob.arrayBuffer());
	const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, plaintext);
	const ctU8 = new Uint8Array(ct);
	const ciphertextBlob = new Blob([ctU8], { type: 'application/octet-stream' });

	// keySecret is the ikm to reveal in link fragment (base64url)
	const keySecret = base64url(ikm);
	return { ciphertext: ciphertextBlob, meta, keySecret };
}
