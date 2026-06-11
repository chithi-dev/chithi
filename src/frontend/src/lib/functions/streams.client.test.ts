import { describe, it, expect } from 'vitest';
import { createZipStream } from './streams';

describe('createZipStream', () => {
    it('should create a valid zip stream from files', async () => {
        const files = [
            new File(['Hello, World!'], 'hello.txt', { type: 'text/plain' }),
            new File([1, 2, 3, 4, 5], 'binary.bin', { type: 'application/octet-stream' }),
        ];

        const stream = await createZipStream(files);
        const reader = stream.getReader();
        const chunks: Uint8Array[] = [];

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
        }

        const total = chunks.reduce((sum, c) => sum + c.length, 0);
        expect(total).toBeGreaterThan(0);

        // Verify ZIP magic bytes (PK = 0x50 0x4b)
        const firstChunk = chunks[0]!;
        expect(firstChunk![0]).toBe(0x50);
        expect(firstChunk![1]).toBe(0x4b);
    });

    it('should handle single file', async () => {
        const files = [
            new File(['single file content'], 'only.txt', { type: 'text/plain' }),
        ];

        const stream = await createZipStream(files);
        const reader = stream.getReader();
        const chunks: Uint8Array[] = [];

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
        }

        expect(chunks.length).toBeGreaterThan(0);
    });

    it('should handle files with same name (deduplication)', async () => {
        const files = [
            new File(['content A'], 'file.txt', { type: 'text/plain' }),
            new File(['content B'], 'file.txt', { type: 'text/plain' }),
        ];

        const stream = await createZipStream(files);
        const reader = stream.getReader();
        const chunks: Uint8Array[] = [];

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
        }

        const total = chunks.reduce((sum, c) => sum + c.length, 0);
        expect(total).toBeGreaterThan(0);
    });

    it('should handle large file', async () => {
        const largeContent = crypto.getRandomValues(new Uint8Array(1024 * 1024)); // 1 MB
        const files = [new File([largeContent], 'large.bin', { type: 'application/octet-stream' })];

        const stream = await createZipStream(files);
        const reader = stream.getReader();
        const chunks: Uint8Array[] = [];

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
        }

        const total = chunks.reduce((sum, c) => sum + c.length, 0);
        // Compressed size of random data is slightly larger due to zip overhead
        expect(total).toBeGreaterThan(1024 * 1024);
    });
});

describe('createMultipartStream', () => {
    it('should produce valid multipart/form-data', async () => {
        const { createMultipartStream } = await import('./streams');
        const boundary = '----FormBoundary123';
        const fileContent = new TextEncoder().encode('file data here');
        const fileStream = new ReadableStream({
            start(controller) {
                controller.enqueue(fileContent);
                controller.close();
            },
        });

        const stream = createMultipartStream(
            boundary,
            { slug: 'test-slug', key: 'test-key' },
            'file',
            'test.txt',
            fileStream,
        );

        const reader = stream.getReader();
        const chunks: Uint8Array[] = [];

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
        }

        const decoder = new TextDecoder();
        const full = decoder.decode(concatUint8Arrays(chunks));

        expect(full).toContain(`--${boundary}`);
        expect(full).toContain('name="slug"');
        expect(full).toContain('test-slug');
        expect(full).toContain('name="file"; filename="test.txt"');
        expect(full).toContain('file data here');
        expect(full).toContain(`--${boundary}--`);
    });
});

function concatUint8Arrays(arrays: Uint8Array[]): Uint8Array {
    const total = arrays.reduce((sum, a) => sum + a.length, 0);
    const result = new Uint8Array(total);
    let offset = 0;
    for (const a of arrays) {
        result.set(a, offset);
        offset += a.length;
    }
    return result;
}
