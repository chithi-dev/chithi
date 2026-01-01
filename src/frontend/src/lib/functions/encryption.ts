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

export type EncryptionMeta = {
	cipher: 'AES-GCM';
	hkdf: { hash: 'SHA-512'; salt: string };
	iv: string;
	pbkdf2?: { salt: string; iterations: number };
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

// Encrypt a blob (tar or gz) using AES-256-GCM with HKDF-SHA-512 derived key.
// Uses chunked encryption (64KB chunks) to support partial decryption.
export async function encryptFile(
	file: Blob,
	password?: string
): Promise<{ ciphertext: Blob; meta: EncryptionMeta; keySecret: string }> {
	// 1. Generate Secrets
	const ikm = crypto.getRandomValues(new Uint8Array(32));
	const hkdfSalt = crypto.getRandomValues(new Uint8Array(16));
	const baseIv = crypto.getRandomValues(new Uint8Array(12));

	let finalIKM = ikm;
	const meta: EncryptionMeta = {
		cipher: 'AES-GCM',
		hkdf: { hash: 'SHA-512', salt: bytesToBase64(hkdfSalt) },
		iv: bytesToBase64(baseIv)
	};

	if (password && password.length > 0) {
		const iterations = 150_000;
		const pbkdf2Salt = crypto.getRandomValues(new Uint8Array(16));
		const pb = await pbkdf2Derive(password, pbkdf2Salt, iterations, 32);
		finalIKM = xorBytes(ikm, pb);
		meta.pbkdf2 = { salt: bytesToBase64(pbkdf2Salt), iterations };
	}

	// 2. Derive AES Key
	const aesKey = await deriveAESKeyFromIKM(finalIKM, hkdfSalt);

	// 3. Encrypt in Chunks
	const chunks: Blob[] = [];
	const totalSize = file.size;
	let offset = 0;
	let chunkIndex = 0;

	// If file is empty, we still want to encrypt it (produces just the tag)
	if (totalSize === 0) {
		const chunkIv = getChunkIv(baseIv, 0);
		const encryptedChunk = await crypto.subtle.encrypt(
			{ name: 'AES-GCM', iv: chunkIv as any },
			aesKey,
			new Uint8Array(0)
		);
		chunks.push(new Blob([encryptedChunk]));
	} else {
		while (offset < totalSize) {
			const chunkBlob = file.slice(offset, offset + CHUNK_SIZE);
			const chunkBuffer = await chunkBlob.arrayBuffer();
			const chunkIv = getChunkIv(baseIv, chunkIndex);

			const encryptedChunk = await crypto.subtle.encrypt(
				{ name: 'AES-GCM', iv: chunkIv as any },
				aesKey,
				chunkBuffer
			);

			chunks.push(new Blob([encryptedChunk]));

			offset += CHUNK_SIZE;
			chunkIndex++;
		}
	}

	const metaJson = JSON.stringify(meta);
	const metaBytes = new TextEncoder().encode(metaJson);
	const metaLen = new Uint8Array(4);
	new DataView(metaLen.buffer).setUint32(0, metaBytes.length, false); // Big endian

	const monolithicBlob = new Blob([metaLen, metaBytes, ...chunks], {
		type: 'application/octet-stream'
	});
	const keySecret = base64url(ikm);

	return { ciphertext: monolithicBlob, meta, keySecret };
}

// Alias for backward compatibility
export const encryptBlobWithHKDF = encryptFile;
