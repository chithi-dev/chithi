import { describe, it, expect } from 'vitest';
import {
	bytesToBase64,
	base64ToBytes,
	base64url,
	base64urlToBytes,
	xorBytes,
	deriveKeys,
	passwordToIkM,
	generateSecret,
} from './encryption';

describe('base64 utilities', () => {
	it('should encode and decode bytes roundtrip', () => {
		const original = new Uint8Array([1, 2, 3, 255, 0, 128]);
		const encoded = bytesToBase64(original);
		const decoded = base64ToBytes(encoded);
		expect(decoded).toEqual(original);
	});

	it('should handle empty input', () => {
		const empty = new Uint8Array([]);
		expect(bytesToBase64(empty)).toBe('');
		expect(base64ToBytes('')).toEqual(empty);
	});

	it('should produce standard base64 output', () => {
		const input = new Uint8Array([97, 100, 110, 105, 110]); // "admin"
		expect(bytesToBase64(input)).toBe('YWRtaW4=');
	});
});

describe('base64url utilities', () => {
	it('should encode and decode roundtrip', () => {
		const original = new Uint8Array([1, 2, 3, 255, 0, 128, 64]);
		const encoded = base64url(original);
		const decoded = base64urlToBytes(encoded);
		expect(decoded).toEqual(original);
	});

	it('should replace + with - and / with _', () => {
		const input = new Uint8Array([0xfb, 0xff, 0xff]);
		const encoded = base64url(input);
		expect(encoded).not.toContain('+');
		expect(encoded).not.toContain('/');
		expect(encoded).not.toContain('=');
	});

	it('should handle empty input', () => {
		const empty = new Uint8Array([]);
		expect(base64url(empty)).toBe('');
		expect(base64urlToBytes('')).toEqual(empty);
	});
});

describe('xorBytes', () => {
	it('should xor two equal-length arrays', () => {
		const a = new Uint8Array([0xff, 0x0f, 0xf0]);
		const b = new Uint8Array([0xf0, 0xf0, 0x0f]);
		expect(xorBytes(a, b)).toEqual(new Uint8Array([0x0f, 0xff, 0xff]));
	});

	it('should xor with self to produce zeros', () => {
		const a = new Uint8Array([1, 2, 3, 4, 5]);
		expect(xorBytes(a, a)).toEqual(new Uint8Array([0, 0, 0, 0, 0]));
	});
});

describe('Web Crypto key derivation', () => {
	it('should produce a 128-bit random secret', () => {
		const secret = generateSecret();
		expect(secret.byteLength).toBe(16);
		expect(generateSecret()).not.toEqual(secret);
	});

	it('should derive a file key and auth key from an IKM', async () => {
		const ikm = crypto.getRandomValues(new Uint8Array(16));
		const { fileKey, authKey } = await deriveKeys(ikm);
		expect(fileKey.algorithm.name).toBe('AES-GCM');
		expect(fileKey.algorithm.length).toBe(128);
		expect(authKey.algorithm.name).toBe('HMAC');
	});

	it('should derive the same keys from the same IKM', async () => {
		const ikm = crypto.getRandomValues(new Uint8Array(16));
		const a = await deriveKeys(ikm);
		const b = await deriveKeys(ikm);
		const rawA = new Uint8Array(await crypto.subtle.exportKey('raw', a.fileKey));
		const rawB = new Uint8Array(await crypto.subtle.exportKey('raw', b.fileKey));
		expect(rawA).toEqual(rawB);
	});

	it('should derive different keys from different IKMs', async () => {
		const a = await deriveKeys(crypto.getRandomValues(new Uint8Array(16)));
		const b = await deriveKeys(crypto.getRandomValues(new Uint8Array(16)));
		const rawA = new Uint8Array(await crypto.subtle.exportKey('raw', a.fileKey));
		const rawB = new Uint8Array(await crypto.subtle.exportKey('raw', b.fileKey));
		expect(rawA).not.toEqual(rawB);
	});

	it('should derive a 128-bit IKM from a password via PBKDF2', async () => {
		const ikm = await passwordToIkM('correct horse battery staple');
		expect(ikm.byteLength).toBe(16);
		const ikm2 = await passwordToIkM('correct horse battery staple');
		expect(ikm).toEqual(ikm2);
	});
});

describe('AES-128-GCM encrypt/decrypt roundtrip', () => {
	it('should encrypt and decrypt a chunk', async () => {
		const ikm = crypto.getRandomValues(new Uint8Array(16));
		const { fileKey } = await deriveKeys(ikm);
		const nonce = crypto.getRandomValues(new Uint8Array(12));
		const plaintext = new TextEncoder().encode('Hello, encrypted world!');

		const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, fileKey, plaintext));
		const pt = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, fileKey, ct));
		expect(new TextDecoder().decode(pt)).toBe('Hello, encrypted world!');
	});

	it('should produce ciphertext 16 bytes longer than plaintext (auth tag)', async () => {
		const { fileKey } = await deriveKeys(crypto.getRandomValues(new Uint8Array(16)));
		const nonce = crypto.getRandomValues(new Uint8Array(12));
		const plaintext = new Uint8Array([1, 2, 3, 4, 5]);
		const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, fileKey, plaintext));
		expect(ct.byteLength).toBe(plaintext.byteLength + 16);
	});

	it('should handle empty plaintext', async () => {
		const { fileKey } = await deriveKeys(crypto.getRandomValues(new Uint8Array(16)));
		const nonce = crypto.getRandomValues(new Uint8Array(12));
		const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, fileKey, new Uint8Array(0)));
		expect(ct.byteLength).toBe(16);
		const pt = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, fileKey, ct));
		expect(pt.byteLength).toBe(0);
	});
});
