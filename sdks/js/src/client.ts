/**
 * Chithi client — encrypted upload/download via WASM.
 */

import { loadWasm, alloc, dealloc, writeToWasm, readFromWasm, readU32 } from './wasm.js';
import { serializeFiles, deserializeFiles } from './serialize.js';
import type { FileEntry, UploadOptions, DownloadOptions, EncryptedBundle, DownloadResult } from './types.js';
import { toUint8Array } from './types.js';

type WasmFn = (...args: unknown[]) => unknown;

export class Chithi {
    private _initialized = false;

    async init(): Promise<void> {
        if (this._initialized) return;
        await loadWasm();
        this._initialized = true;
    }

    private ensure(): void {
        if (!this._initialized) {
            throw new Error('Chithi not initialized. Call chithi.init() first.');
        }
    }

    async upload(
        files: FileEntry[],
        options: UploadOptions,
    ): Promise<EncryptedBundle> {
        this.ensure();
        const wasm = await loadWasm();
        const normalized = files.map((f) => ({
            name: f.name,
            data: toUint8Array(f.data),
        }));
        const serialized = serializeFiles(normalized);
        const pwdBytes = new TextEncoder().encode(options.password);

        const inputPtr = alloc(wasm, serialized.length);
        const pwdPtr = alloc(wasm, pwdBytes.length);
        const outPtr = alloc(wasm, serialized.length * 4);
        const outLenPtr = alloc(wasm, 4);

        writeToWasm(wasm, inputPtr, serialized);
        writeToWasm(wasm, pwdPtr, pwdBytes);

        const status = (wasm.exports.wasm_upload as WasmFn)(
            inputPtr,
            serialized.length,
            pwdPtr,
            pwdBytes.length,
            outPtr,
            outLenPtr,
            0,
            0,
        ) as number;

        if (status !== 0) {
            dealloc(wasm, inputPtr, serialized.length);
            dealloc(wasm, pwdPtr, pwdBytes.length);
            dealloc(wasm, outPtr, serialized.length * 4);
            dealloc(wasm, outLenPtr, 4);
            throw new Error(`Upload failed with status ${status}`);
        }

        const outLen = readU32(wasm, outLenPtr);
        const bundle = readFromWasm(wasm, outPtr, outLen);

        dealloc(wasm, inputPtr, serialized.length);
        dealloc(wasm, pwdPtr, pwdBytes.length);
        dealloc(wasm, outPtr, outLen);
        dealloc(wasm, outLenPtr, 4);

        return { bytes: bundle };
    }

    async download(
        bundle: EncryptedBundle | Uint8Array,
        options: DownloadOptions,
    ): Promise<DownloadResult> {
        this.ensure();
        const wasm = await loadWasm();
        const bytes = 'bytes' in bundle ? bundle.bytes : bundle;
        const pwdBytes = new TextEncoder().encode(options.password);

        const bundlePtr = alloc(wasm, bytes.length);
        const pwdPtr = alloc(wasm, pwdBytes.length);
        const outPtr = alloc(wasm, bytes.length * 2);
        const outLenPtr = alloc(wasm, 4);

        writeToWasm(wasm, bundlePtr, bytes);
        writeToWasm(wasm, pwdPtr, pwdBytes);

        const status = (wasm.exports.wasm_download as WasmFn)(
            bundlePtr,
            bytes.length,
            pwdPtr,
            pwdBytes.length,
            outPtr,
            outLenPtr,
            0,
            0,
        ) as number;

        if (status !== 0) {
            dealloc(wasm, bundlePtr, bytes.length);
            dealloc(wasm, pwdPtr, pwdBytes.length);
            dealloc(wasm, outPtr, bytes.length * 2);
            dealloc(wasm, outLenPtr, 4);
            throw new Error(`Download failed with status ${status}`);
        }

        const outLen = readU32(wasm, outLenPtr);
        const resultData = readFromWasm(wasm, outPtr, outLen);
        const files = deserializeFiles(resultData);

        dealloc(wasm, bundlePtr, bytes.length);
        dealloc(wasm, pwdPtr, pwdBytes.length);
        dealloc(wasm, outPtr, outLen);
        dealloc(wasm, outLenPtr, 4);

        return { files };
    }
}

export function createChithi(): Chithi {
    return new Chithi();
}
