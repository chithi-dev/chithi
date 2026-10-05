import { describe, it, expect } from 'vitest';
import {
	bytesToBase64,
	base64ToBytes,
	base64url,
	base64urlToBytes,
	deriveFileKey,
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

describe('scheme v3 key material', () => {
	it('should produce a 256-bit random secret', () => {
		const secret = generateSecret();
		expect(secret.byteLength).toBe(32);
		expect(generateSecret()).not.toEqual(secret);
	});

	it('should derive a 256-bit AES-GCM file key from an IKM via HKDF', async () => {
		const ikm = crypto.getRandomValues(new Uint8Array(32));
		const salt = crypto.getRandomValues(new Uint8Array(16));
		const fileKey = await deriveFileKey(ikm, salt);
		expect(fileKey.algorithm.name).toBe('AES-GCM');
		expect((fileKey.algorithm as AesKeyAlgorithm).length).toBe(256);
	});

	it('should derive the same key from the same IKM + salt', async () => {
		const ikm = crypto.getRandomValues(new Uint8Array(32));
		const salt = crypto.getRandomValues(new Uint8Array(16));
		const a = await deriveFileKey(ikm, salt);
		const b = await deriveFileKey(ikm, salt);
		const rawA = new Uint8Array(await crypto.subtle.exportKey('raw', a));
		const rawB = new Uint8Array(await crypto.subtle.exportKey('raw', b));
		expect(rawA).toEqual(rawB);
	});

	it('should derive different keys from different salts (same IKM)', async () => {
		const ikm = crypto.getRandomValues(new Uint8Array(32));
		const saltA = crypto.getRandomValues(new Uint8Array(16));
		const saltB = crypto.getRandomValues(new Uint8Array(16));
		const a = await deriveFileKey(ikm, saltA);
		const b = await deriveFileKey(ikm, saltB);
		const rawA = new Uint8Array(await crypto.subtle.exportKey('raw', a));
		const rawB = new Uint8Array(await crypto.subtle.exportKey('raw', b));
		expect(rawA).not.toEqual(rawB);
	});

	it('should derive a 256-bit IKM from a password via Argon2id', async () => {
		const salt = crypto.getRandomValues(new Uint8Array(16));
		const ikm = await passwordToIkM('correct horse battery staple', salt);
		expect(ikm.byteLength).toBe(32);
		const ikm2 = await passwordToIkM('correct horse battery staple', salt);
		expect(ikm).toEqual(ikm2);
	});

	it('should derive different IKMs from the same password with different salts', async () => {
		const saltA = crypto.getRandomValues(new Uint8Array(16));
		const saltB = crypto.getRandomValues(new Uint8Array(16));
		const ikmA = await passwordToIkM('same-password', saltA);
		const ikmB = await passwordToIkM('same-password', saltB);
		expect(ikmA).not.toEqual(ikmB);
	});
});

describe('AES-256-GCM encrypt/decrypt roundtrip', () => {
	it('should encrypt and decrypt a chunk', async () => {
		const ikm = crypto.getRandomValues(new Uint8Array(32));
		const salt = crypto.getRandomValues(new Uint8Array(16));
		const fileKey = await deriveFileKey(ikm, salt);
		const nonce = crypto.getRandomValues(new Uint8Array(12));
		const plaintext = new TextEncoder().encode('Hello, encrypted world!');

		const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, fileKey, plaintext));
		const pt = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, fileKey, ct));
		expect(new TextDecoder().decode(pt)).toBe('Hello, encrypted world!');
	});

	it('should produce ciphertext 16 bytes longer than plaintext (auth tag)', async () => {
		const ikm = crypto.getRandomValues(new Uint8Array(32));
		const fileKey = await deriveFileKey(ikm, crypto.getRandomValues(new Uint8Array(16)));
		const nonce = crypto.getRandomValues(new Uint8Array(12));
		const plaintext = new Uint8Array([1, 2, 3, 4, 5]);
		const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, fileKey, plaintext));
		expect(ct.byteLength).toBe(plaintext.byteLength + 16);
	});

	it('should handle empty plaintext', async () => {
		const ikm = crypto.getRandomValues(new Uint8Array(32));
		const fileKey = await deriveFileKey(ikm, crypto.getRandomValues(new Uint8Array(16)));
		const nonce = crypto.getRandomValues(new Uint8Array(12));
		const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, fileKey, new Uint8Array(0)));
		expect(ct.byteLength).toBe(16);
		const pt = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, fileKey, ct));
		expect(pt.byteLength).toBe(0);
	});
});
