/**
 * Chithi client — encrypted upload/download via WASM.
 */

import {
    loadWasm,
    alloc,
    dealloc,
    writeToWasm,
    readFromWasm,
    readU32,
} from './wasm';
import { serializeFiles, deserializeFiles } from './serialize';
import type {
    FileEntry,
    UploadOptions,
    DownloadOptions,
    EncryptedBundle,
    DownloadResult,
} from './types';
import { toUint8Array } from './types';

type WasmFn = (...args: unknown[]) => unknown;

export class Chithi {
    #init: Promise<void> | null = null;

    init(): Promise<void> {
        if (this.#init) return this.#init;
        this.#init = loadWasm().then(() => {});
        return this.#init;
    }

    #ensure(): void {
        if (!this.#init)
            throw new Error(
                'Chithi not initialized. Call chithi.init() first.',
            );
    }

    async upload(
        files: FileEntry[],
        options: UploadOptions,
    ): Promise<EncryptedBundle> {
        this.#ensure();
        const w = await loadWasm();
        const normalized = files.map((f) => ({
            name: f.name,
            data: toUint8Array(f.data),
        }));
        const serialized = serializeFiles(normalized);
        const pwd = new TextEncoder().encode(options.password);

        const inputPtr = alloc(w, serialized.length);
        const pwdPtr = alloc(w, pwd.length);
        const outPtr = alloc(w, serialized.length * 4);
        const outLenPtr = alloc(w, 4);

        writeToWasm(w, inputPtr, serialized);
        writeToWasm(w, pwdPtr, pwd);

        const status = (w.exports.wasm_upload as WasmFn)(
            inputPtr,
            serialized.length,
            pwdPtr,
            pwd.length,
            outPtr,
            outLenPtr,
            0,
            0,
        ) as number;

        if (status !== 0) {
            dealloc(w, inputPtr, serialized.length);
            dealloc(w, pwdPtr, pwd.length);
            dealloc(w, outPtr, serialized.length * 4);
            dealloc(w, outLenPtr, 4);
            throw new Error(`Upload failed with status ${status}`);
        }

        const outLen = readU32(w, outLenPtr);
        const bundle = readFromWasm(w, outPtr, outLen);

        dealloc(w, inputPtr, serialized.length);
        dealloc(w, pwdPtr, pwd.length);
        dealloc(w, outPtr, outLen);
        dealloc(w, outLenPtr, 4);

        return { bytes: bundle };
    }

    async download(
        bundle: EncryptedBundle | Uint8Array,
        options: DownloadOptions,
    ): Promise<DownloadResult> {
        this.#ensure();
        const w = await loadWasm();
        const bytes = 'bytes' in bundle ? bundle.bytes : bundle;
        const pwd = new TextEncoder().encode(options.password);

        const bundlePtr = alloc(w, bytes.length);
        const pwdPtr = alloc(w, pwd.length);
        const outPtr = alloc(w, bytes.length * 2);
        const outLenPtr = alloc(w, 4);

        writeToWasm(w, bundlePtr, bytes);
        writeToWasm(w, pwdPtr, pwd);

        const status = (w.exports.wasm_download as WasmFn)(
            bundlePtr,
            bytes.length,
            pwdPtr,
            pwd.length,
            outPtr,
            outLenPtr,
            0,
            0,
        ) as number;

        if (status !== 0) {
            dealloc(w, bundlePtr, bytes.length);
            dealloc(w, pwdPtr, pwd.length);
            dealloc(w, outPtr, bytes.length * 2);
            dealloc(w, outLenPtr, 4);
            throw new Error(`Download failed with status ${status}`);
        }

        const outLen = readU32(w, outLenPtr);
        const resultData = readFromWasm(w, outPtr, outLen);
        const files = deserializeFiles(resultData);

        dealloc(w, bundlePtr, bytes.length);
        dealloc(w, pwdPtr, pwd.length);
        dealloc(w, outPtr, outLen);
        dealloc(w, outLenPtr, 4);

        return { files };
    }
}

export function createChithi(): Chithi {
    return new Chithi();
}
