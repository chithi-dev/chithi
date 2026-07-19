import { describe, it, expect, beforeAll } from 'vitest';
import {
    bytesToBase64,
    base64ToBytes,
    base64url,
    base64urlToBytes,
    xorBytes,
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
        const input = new Uint8Array([97, 100, 109, 105, 110]); // "admin"
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
        const input = new Uint8Array([0xfb, 0xff, 0xff]); // produces + and / in standard base64
        const encoded = base64url(input);
        expect(encoded).not.toContain('+');
        expect(encoded).not.toContain('/');
        expect(encoded).not.toContain('=');
    });

    it('should strip padding', () => {
        const input = new Uint8Array([1, 2, 3]);
        const encoded = base64url(input);
        expect(encoded.endsWith('=')).toBe(false);
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
        const result = xorBytes(a, b);
        expect(result).toEqual(new Uint8Array([0x0f, 0xff, 0xff]));
    });

    it('should xor with self to produce zeros', () => {
        const a = new Uint8Array([1, 2, 3, 4, 5]);
        const result = xorBytes(a, a);
        expect(result).toEqual(new Uint8Array([0, 0, 0, 0, 0]));
    });

    it('should handle different length arrays', () => {
        const a = new Uint8Array([1, 2, 3, 4, 5]);
        const b = new Uint8Array([1, 2]);
        const result = xorBytes(a, b);
        expect(result.length).toBe(5);
        expect(result[0]).toBe(0); // 1 ^ 1
        expect(result[1]).toBe(0); // 2 ^ 2
        expect(result[2]).toBe(3); // 3 ^ 0
    });

    it('should xor with empty array to produce identity', () => {
        const a = new Uint8Array([42, 99]);
        const b = new Uint8Array([]);
        const result = xorBytes(a, b);
        expect(result).toEqual(a);
    });
});

describe('XChaCha20-Poly1305 encryption roundtrip via WASM', async () => {
    const { ensureInitialized, wasmEncryptChunk, wasmDecryptChunk, wasmGetChunkNonce } = await import('#wasm/chithi_wasm');

    beforeAll(async () => {
        await ensureInitialized();
    });

    it('should encrypt and decrypt a chunk', () => {
        const key = crypto.getRandomValues(new Uint8Array(32));
        const nonce = crypto.getRandomValues(new Uint8Array(24));
        const plaintext = new TextEncoder().encode('Hello, encrypted world!');

        const encrypted = wasmEncryptChunk(plaintext, key, nonce);
        const decrypted = wasmDecryptChunk(encrypted, key, nonce);
        expect(new TextDecoder().decode(decrypted)).toBe('Hello, encrypted world!');
    });

    it('should produce ciphertext longer than plaintext (auth tag)', () => {
        const key = crypto.getRandomValues(new Uint8Array(32));
        const nonce = crypto.getRandomValues(new Uint8Array(24));
        const plaintext = new Uint8Array([1, 2, 3, 4, 5]);

        const encrypted = wasmEncryptChunk(plaintext, key, nonce);
        expect(encrypted.length).toBe(plaintext.length + 16);
    });

    it('should handle empty plaintext', () => {
        const key = crypto.getRandomValues(new Uint8Array(32));
        const nonce = crypto.getRandomValues(new Uint8Array(24));
        const plaintext = new Uint8Array([]);

        const encrypted = wasmEncryptChunk(plaintext, key, nonce);
        expect(encrypted.length).toBe(16);

        const decrypted = wasmDecryptChunk(encrypted, key, nonce);
        expect(decrypted.length).toBe(0);
    });

    it('should handle large data (1 MB)', () => {
        const key = crypto.getRandomValues(new Uint8Array(32));
        const nonce = crypto.getRandomValues(new Uint8Array(24));
        const size = 1024 * 1024;
        const plaintext = crypto.getRandomValues(new Uint8Array(size));

        const encrypted = wasmEncryptChunk(plaintext, key, nonce);
        expect(encrypted.length).toBe(size + 16);

        const decrypted = wasmDecryptChunk(encrypted, key, nonce);
        expect(decrypted).toEqual(plaintext);
    });

    it('should derive correct per-chunk nonces via wasmGetChunkNonce', () => {
        const baseIv = crypto.getRandomValues(new Uint8Array(24));
        const nonce0 = wasmGetChunkNonce(baseIv, 0);
        expect(nonce0).toEqual(baseIv);

        const nonce1 = wasmGetChunkNonce(baseIv, 1);
        expect(nonce1.length).toBe(24);
        expect(nonce1).not.toEqual(nonce0);
    });
});

describe('HKDF key derivation', () => {
    it('should derive 32-byte key material from IKM using Web Crypto HKDF', async () => {
        const ikm = crypto.getRandomValues(new Uint8Array(32));
        const salt = crypto.getRandomValues(new Uint8Array(16));

        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            ikm,
            'HKDF',
            false,
            ['deriveBits'],
        );

        const derivedBits = await crypto.subtle.deriveBits(
            { name: 'HKDF', hash: 'SHA-256', salt, info: new TextEncoder().encode('encryption-key') },
            keyMaterial,
            256,
        );

        expect(derivedBits.byteLength).toBe(32);
    });

    it('should produce different keys for different info strings', async () => {
        const ikm = crypto.getRandomValues(new Uint8Array(32));
        const salt = crypto.getRandomValues(new Uint8Array(16));

        const keyMaterial = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);

        const bits1 = await crypto.subtle.deriveBits(
            { name: 'HKDF', hash: 'SHA-256', salt, info: new TextEncoder().encode('key-1') },
            keyMaterial,
            256,
        );

        const bits2 = await crypto.subtle.deriveBits(
            { name: 'HKDF', hash: 'SHA-256', salt, info: new TextEncoder().encode('key-2') },
            keyMaterial,
            256,
        );

        expect(bits1).not.toEqual(bits2);
    });
});
