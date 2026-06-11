import { describe, it, expect, beforeAll } from 'vitest';

let wasm: typeof import('./chithi_core') | null = null;

async function getWasm() {
    if (!wasm) {
        wasm = await import('./chithi_core');
        // Initialize WASM (the chithi_core module auto-initializes on import in Node)
    }
    return wasm;
}

describe('chithi_core WASM - Argon2', () => {
    beforeAll(async () => {
        await getWasm();
    }, 15000);

    it('should derive key with argon2_derive', async () => {
        const mod = await getWasm();
        const password = new TextEncoder().encode('test-password');
        const salt = new TextEncoder().encode('test-salt-value!!'); // 16 bytes

        const key = mod!.argon2_derive(password, salt, 3, 1024, 32);

        expect(key).toBeInstanceOf(Uint8Array);
        expect(key.length).toBe(32);
    });

    it('should produce consistent key for same password+salt', async () => {
        const mod = await getWasm();
        const password = new TextEncoder().encode('same-password');
        const salt = new TextEncoder().encode('same-salt-value!!');

        const key1 = mod!.argon2_derive(password, salt, 3, 1024, 32);
        const key2 = mod!.argon2_derive(password, salt, 3, 1024, 32);

        expect(key1).toEqual(key2);
    });

    it('should produce different key for different password', async () => {
        const mod = await getWasm();
        const salt = new TextEncoder().encode('salt-for-testing!!');

        const key1 = mod!.argon2_derive(new TextEncoder().encode('pass-1'), salt, 3, 1024, 32);
        const key2 = mod!.argon2_derive(new TextEncoder().encode('pass-2'), salt, 3, 1024, 32);

        expect(key1).not.toEqual(key2);
    });

    it('should produce different key for different salt', async () => {
        const mod = await getWasm();
        const password = new TextEncoder().encode('my-password');

        const key1 = mod!.argon2_derive(password, new TextEncoder().encode('salt-one----------'), 3, 1024, 32);
        const key2 = mod!.argon2_derive(password, new TextEncoder().encode('salt-two----------'), 3, 1024, 32);

        expect(key1).not.toEqual(key2);
    });

    it('should generate random IKM', async () => {
        const mod = await getWasm();
        const ikm1 = mod!.generate_ikm();
        const ikm2 = mod!.generate_ikm();

        expect(ikm1).toBeInstanceOf(Uint8Array);
        expect(ikm1.length).toBe(32);
        expect(ikm1).not.toEqual(ikm2);
    });
});

describe('chithi_core WASM - 7z', () => {
    beforeAll(async () => {
        await getWasm();
    }, 15000);

    it('should compress and validate 7z archive', async () => {
        const mod = await getWasm();
        const entries = ['test.txt', 'hello.txt'];
        const datas = [
            new TextEncoder().encode('Hello from file 1'),
            new TextEncoder().encode('Hello from file 2'),
        ];

        const compressed = mod!.compress(entries, datas);
        expect(compressed).toBeInstanceOf(Uint8Array);
        expect(compressed.length).toBeGreaterThan(0);

        // Validate as 7z
        const isValid = mod!.validate_7z(compressed);
        expect(isValid).toBe(true);
    });

    it('should decompress 7z archive', async () => {
        const mod = await getWasm();
        const entries = ['readme.txt'];
        const datas = [new TextEncoder().encode('Test content for decompression')];

        const compressed = mod!.compress(entries, datas);

        const results: { name: string; data: Uint8Array }[] = [];
        mod!.decompress(compressed, '', (name: string, data: Uint8Array) => {
            results.push({ name, data });
        });

        expect(results).toHaveLength(1);
        expect(results[0].name).toBe('readme.txt');
        expect(new TextDecoder().decode(results[0].data)).toBe('Test content for decompression');
    });

    it('should handle multiple files', async () => {
        const mod = await getWasm();
        const fileCount = 5;
        const entries: string[] = [];
        const datas: Uint8Array[] = [];

        for (let i = 0; i < fileCount; i++) {
            entries.push(`file-${i}.txt`);
            datas.push(new TextEncoder().encode(`Content of file ${i}`));
        }

        const compressed = mod!.compress(entries, datas);
        const results: { name: string; data: Uint8Array }[] = [];

        mod!.decompress(compressed, '', (name: string, data: Uint8Array) => {
            results.push({ name, data });
        });

        expect(results).toHaveLength(fileCount);

        for (let i = 0; i < fileCount; i++) {
            const result = results.find((r) => r.name === `file-${i}.txt`);
            expect(result).toBeTruthy();
            expect(new TextDecoder().decode(result!.data)).toBe(`Content of file ${i}`);
        }
    });

    it('should reject invalid 7z data', async () => {
        const mod = await getWasm();
        const invalid = new Uint8Array([0, 1, 2, 3, 4, 5]);

        expect(() => mod!.validate_7z(invalid)).toThrow();
    });

    it('should handle binary content', async () => {
        const mod = await getWasm();
        const binaryData = crypto.getRandomValues(new Uint8Array(1024));
        const entries = ['binary.bin'];
        const datas = [binaryData];

        const compressed = mod!.compress(entries, datas);
        const results: { name: string; data: Uint8Array }[] = [];

        mod!.decompress(compressed, '', (name: string, data: Uint8Array) => {
            results.push({ name, data });
        });

        expect(results[0].data).toEqual(binaryData);
    });

    it('should handle large content', async () => {
        const mod = await getWasm();
        const largeData = crypto.getRandomValues(new Uint8Array(1024 * 1024)); // 1 MB
        const entries = ['large.bin'];
        const datas = [largeData];

        const compressed = mod!.compress(entries, datas);
        const results: { name: string; data: Uint8Array }[] = [];

        mod!.decompress(compressed, '', (name: string, data: Uint8Array) => {
            results.push({ name, data });
        });

        expect(results[0].data).toEqual(largeData);
    });
});

describe('chithi_core WASM - 7z JSON API', () => {
    beforeAll(async () => {
        await getWasm();
    }, 15000);

    it('should compress with compress_7z JSON API', async () => {
        const mod = await getWasm();
        const input = JSON.stringify([
            { name: 'test.txt', data: Array.from(new TextEncoder().encode('Hello, 7z!')) },
        ]);

        const compressed = mod!.compress_7z(input);
        expect(compressed).toBeInstanceOf(Uint8Array);
        expect(compressed.length).toBeGreaterThan(0);
    });

    it('should decompress with decompress_7z JSON API', async () => {
        const mod = await getWasm();
        const original = 'Hello from JSON API';
        const input = JSON.stringify([
            { name: 'test.txt', data: Array.from(new TextEncoder().encode(original)) },
        ]);

        const compressed = mod!.compress_7z(input);
        const result = mod!.decompress_7z(compressed);
        const entries = JSON.parse(result);

        expect(entries).toHaveLength(1);
        expect(entries[0].name).toBe('test.txt');
        const decoded = new TextDecoder().decode(Uint8Array.from(entries[0].data));
        expect(decoded).toBe(original);
    });
});
