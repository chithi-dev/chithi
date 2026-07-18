/**
 * Chithi WASM wrapper — C ABI interface for the frontend.
 *
 * Wraps the raw WASM C ABI exports in a safe, ergonomic API.
 * The WASM module is loaded from chithi.wasm (built by scripts/build_wasm.py).
 */

import init, { getMemory, getInstance } from "./wasm_bindings.js";

let initialized = false;
let initPromise: Promise<void> | null = null;

// ============================================================================
// Memory helpers
// ============================================================================

function _getExports() {
    const inst = getInstance();
    if (!inst) throw new Error("WASM not initialized");
    return inst.exports;
}

function _alloc(len: number): number {
    return (_getExports().chithi_alloc as any)(len);
}

function _dealloc(ptr: number, len: number): void {
    (_getExports().chithi_dealloc as any)(ptr, len);
}

function _writeBytes(ptr: number, data: Uint8Array): void {
    const mem = getMemory();
    if (!mem) throw new Error("WASM memory not available");
    new Uint8Array(mem.buffer).set(data, ptr);
}

function _readBytes(ptr: number, len: number): Uint8Array {
    const mem = getMemory();
    if (!mem) throw new Error("WASM memory not available");
    return new Uint8Array(mem.buffer).slice(ptr, ptr + len);
}

function _readU32(ptr: number): number {
    const mem = getMemory();
    if (!mem) throw new Error("WASM memory not available");
    return new DataView(mem.buffer).getUint32(ptr, true);
}

// ============================================================================
// Initialization
// ============================================================================

export async function ensureInitialized(): Promise<void> {
    if (initialized) return;
    if (initPromise) return initPromise;
    initPromise = init().then(() => { initialized = true; });
    try {
        await initPromise;
    } finally {
        initPromise = null;
    }
}

// ============================================================================
// 7z operations
// ============================================================================

export interface SevenEntry {
    name: string;
    data: Uint8Array;
}

function _serializeFiles(files: { name: string; data: Uint8Array }[]): Uint8Array {
    const encoder = new TextEncoder();
    let total = 4;
    for (const f of files) {
        const nb = encoder.encode(f.name);
        total += 4 + nb.length + 4 + f.data.length;
    }
    const result = new Uint8Array(total);
    const view = new DataView(result.buffer);
    view.setUint32(0, files.length);
    let off = 4;
    for (const f of files) {
        const nb = encoder.encode(f.name);
        view.setUint32(off, nb.length); off += 4;
        result.set(nb, off); off += nb.length;
        view.setUint32(off, f.data.length); off += 4;
        result.set(f.data, off); off += f.data.length;
    }
    return result;
}

function _deserializeFiles(data: Uint8Array): SevenEntry[] {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const decoder = new TextDecoder();
    let num = view.getUint32(0);
    let off = 4;
    const results: SevenEntry[] = [];
    for (let i = 0; i < num; i++) {
        const nl = view.getUint32(off); off += 4;
        const name = decoder.decode(data.slice(off, off + nl)); off += nl;
        const dl = view.getUint32(off); off += 4;
        const fd = data.slice(off, off + dl); off += dl;
        results.push({ name, data: fd });
    }
    return results;
}

export function compress7z(entries: SevenEntry[], password?: string): Uint8Array {
    const serialized = _serializeFiles(entries);
    const pwd = password?.length ? new TextEncoder().encode(password) : new Uint8Array(0);

    const inputPtr = _alloc(serialized.length);
    const pwdPtr = pwd.length > 0 ? _alloc(pwd.length) : 0;
    const outPtr = _alloc(serialized.length * 2);
    const outLenPtr = _alloc(4);

    _writeBytes(inputPtr, serialized);
    if (pwd.length > 0) _writeBytes(pwdPtr, pwd);

    const status = (_getExports().compress_7z as any)(
        inputPtr, serialized.length,
        pwdPtr, pwd.length,
        outPtr, outLenPtr,
    );
    if (status !== 0) throw new Error(`compress_7z failed: ${status}`);

    const outLen = _readU32(outLenPtr);
    const result = _readBytes(outPtr, outLen);

    _dealloc(inputPtr, serialized.length);
    if (pwd.length > 0) _dealloc(pwdPtr, pwd.length);
    _dealloc(outPtr, outLen);
    _dealloc(outLenPtr, 4);
    return result;
}

export function decompress7z(data: Uint8Array, password?: string): Promise<SevenEntry[]> {
    return new Promise((resolve, reject) => {
        try {
            const pwd = new TextEncoder().encode(password ?? "");
            const dataPtr = _alloc(data.length);
            const pwdPtr = pwd.length > 0 ? _alloc(pwd.length) : 0;
            const outPtr = _alloc(data.length * 2);
            const outLenPtr = _alloc(4);

            _writeBytes(dataPtr, data);
            if (pwd.length > 0) _writeBytes(pwdPtr, pwd);

            const status = (_getExports().decompress_7z as any)(
                dataPtr, data.length,
                pwdPtr, pwd.length,
                outPtr, outLenPtr,
            );
            if (status !== 0) throw new Error(`decompress_7z failed: ${status}`);

            const outLen = _readU32(outLenPtr);
            const resultData = _readBytes(outPtr, outLen);
            const entries = _deserializeFiles(resultData);

            _dealloc(dataPtr, data.length);
            if (pwd.length > 0) _dealloc(pwdPtr, pwd.length);
            _dealloc(outPtr, outLen);
            _dealloc(outLenPtr, 4);

            resolve(entries);
        } catch (e) {
            reject(e);
        }
    });
}

export function validate7z(data: Uint8Array): boolean {
    const dataPtr = _alloc(data.length);
    _writeBytes(dataPtr, data);
    const result = (_getExports().validate_7z as any)(dataPtr, data.length);
    _dealloc(dataPtr, data.length);
    return result === 1;
}

// ============================================================================
// Key derivation
// ============================================================================

export function wasmDeriveKey(password: Uint8Array, salt: Uint8Array): Uint8Array {
    const pwdPtr = _alloc(password.length);
    const saltPtr = _alloc(salt.length);
    const outPtr = _alloc(32);
    _writeBytes(pwdPtr, password);
    _writeBytes(saltPtr, salt);
    const status = (_getExports().wasm_derive_key as any)(pwdPtr, password.length, saltPtr, salt.length, outPtr);
    if (status !== 0) throw new Error(`derive_key failed: ${status}`);
    const result = _readBytes(outPtr, 32);
    _dealloc(pwdPtr, password.length);
    _dealloc(saltPtr, salt.length);
    _dealloc(outPtr, 32);
    return result;
}

export function argon2DeriveWasm(
    password: Uint8Array, salt: Uint8Array,
    iterations: number, memoryCostKib: number, hashLength: number,
): Uint8Array {
    const pwdPtr = _alloc(password.length);
    const saltPtr = _alloc(salt.length);
    const outPtr = _alloc(hashLength);
    _writeBytes(pwdPtr, password);
    _writeBytes(saltPtr, salt);
    const status = (_getExports().wasm_argon2_derive as any)(
        pwdPtr, password.length, saltPtr, salt.length,
        iterations, memoryCostKib, hashLength, outPtr,
    );
    if (status !== 0) throw new Error(`argon2_derive failed: ${status}`);
    const result = _readBytes(outPtr, hashLength);
    _dealloc(pwdPtr, password.length);
    _dealloc(saltPtr, salt.length);
    _dealloc(outPtr, hashLength);
    return result;
}

export function generateIkmWasm(): Uint8Array {
    const outPtr = _alloc(32);
    (_getExports().wasm_generate_ikm as any)(outPtr);
    const result = _readBytes(outPtr, 32);
    _dealloc(outPtr, 32);
    return result;
}

export function wasmGenerateSecret(): string {
    const outPtr = _alloc(64);
    const len = (_getExports().wasm_generate_secret as any)(outPtr, 64);
    if (len < 0) throw new Error(`generate_secret failed: ${len}`);
    const result = new TextDecoder().decode(_readBytes(outPtr, len));
    _dealloc(outPtr, 64);
    return result;
}

// ============================================================================
// Chunk encryption (XChaCha20-Poly1305)
// ============================================================================

export function wasmEncryptChunk(data: Uint8Array, key: Uint8Array, nonce: Uint8Array): Uint8Array {
    const dataPtr = _alloc(data.length);
    const keyPtr = _alloc(32);
    const noncePtr = _alloc(24);
    const outPtr = _alloc(data.length + 16);
    const outLenPtr = _alloc(4);
    _writeBytes(dataPtr, data);
    _writeBytes(keyPtr, key);
    _writeBytes(noncePtr, nonce);
    const status = (_getExports().wasm_encrypt_chunk as any)(dataPtr, data.length, keyPtr, noncePtr, outPtr, outLenPtr);
    if (status !== 0) throw new Error(`encrypt_chunk failed: ${status}`);
    const outLen = _readU32(outLenPtr);
    const result = _readBytes(outPtr, outLen);
    _dealloc(dataPtr, data.length);
    _dealloc(keyPtr, 32);
    _dealloc(noncePtr, 24);
    _dealloc(outPtr, outLen);
    _dealloc(outLenPtr, 4);
    return result;
}

export function wasmDecryptChunk(data: Uint8Array, key: Uint8Array, nonce: Uint8Array): Uint8Array {
    const dataPtr = _alloc(data.length);
    const keyPtr = _alloc(32);
    const noncePtr = _alloc(24);
    const outPtr = _alloc(data.length);
    const outLenPtr = _alloc(4);
    _writeBytes(dataPtr, data);
    _writeBytes(keyPtr, key);
    _writeBytes(noncePtr, nonce);
    const status = (_getExports().wasm_decrypt_chunk as any)(dataPtr, data.length, keyPtr, noncePtr, outPtr, outLenPtr);
    if (status !== 0) throw new Error(`decrypt_chunk failed: ${status}`);
    const outLen = _readU32(outLenPtr);
    const result = _readBytes(outPtr, outLen);
    _dealloc(dataPtr, data.length);
    _dealloc(keyPtr, 32);
    _dealloc(noncePtr, 24);
    _dealloc(outPtr, outLen);
    _dealloc(outLenPtr, 4);
    return result;
}

export function wasmGetChunkNonce(baseIv: Uint8Array, chunkIndex: number): Uint8Array {
    const basePtr = _alloc(24);
    const outPtr = _alloc(24);
    _writeBytes(basePtr, baseIv);
    (_getExports().wasm_get_chunk_nonce as any)(basePtr, chunkIndex, outPtr);
    const result = _readBytes(outPtr, 24);
    _dealloc(basePtr, 24);
    _dealloc(outPtr, 24);
    return result;
}

// ============================================================================
// Batch operations
// ============================================================================

function _serializeChunks(chunks: Uint8Array[]): Uint8Array {
    let total = 4;
    for (const c of chunks) total += 4 + c.length;
    const result = new Uint8Array(total);
    const view = new DataView(result.buffer);
    view.setUint32(0, chunks.length);
    let off = 4;
    for (const c of chunks) {
        view.setUint32(off, c.length); off += 4;
        result.set(c, off); off += c.length;
    }
    return result;
}

function _deserializeChunks(data: Uint8Array): Uint8Array[] {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const num = view.getUint32(0);
    let off = 4;
    const results: Uint8Array[] = [];
    for (let i = 0; i < num; i++) {
        const len = view.getUint32(off); off += 4;
        results.push(data.slice(off, off + len));
        off += len;
    }
    return results;
}

export function wasmEncryptChunksParallel(
    chunks: Uint8Array[], key: Uint8Array, baseIv: Uint8Array,
): Uint8Array[] {
    const serialized = _serializeChunks(chunks);
    const inputPtr = _alloc(serialized.length);
    const keyPtr = _alloc(32);
    const ivPtr = _alloc(24);
    const outPtr = _alloc(serialized.length * 2);
    const outLenPtr = _alloc(4);
    _writeBytes(inputPtr, serialized);
    _writeBytes(keyPtr, key);
    _writeBytes(ivPtr, baseIv);
    const status = (_getExports().wasm_encrypt_chunks_parallel as any)(
        inputPtr, serialized.length, keyPtr, ivPtr, outPtr, outLenPtr, 0, 0,
    );
    if (status !== 0) throw new Error(`encrypt_chunks_parallel failed: ${status}`);
    const outLen = _readU32(outLenPtr);
    const resultData = _readBytes(outPtr, outLen);
    const results = _deserializeChunks(resultData);
    _dealloc(inputPtr, serialized.length);
    _dealloc(keyPtr, 32);
    _dealloc(ivPtr, 24);
    _dealloc(outPtr, outLen);
    _dealloc(outLenPtr, 4);
    return results;
}

export function wasmDecryptChunksParallel(
    chunks: Uint8Array[], key: Uint8Array, baseIv: Uint8Array,
): Uint8Array[] {
    const serialized = _serializeChunks(chunks);
    const inputPtr = _alloc(serialized.length);
    const keyPtr = _alloc(32);
    const ivPtr = _alloc(24);
    const outPtr = _alloc(serialized.length * 2);
    const outLenPtr = _alloc(4);
    _writeBytes(inputPtr, serialized);
    _writeBytes(keyPtr, key);
    _writeBytes(ivPtr, baseIv);
    const status = (_getExports().wasm_decrypt_chunks_parallel as any)(
        inputPtr, serialized.length, keyPtr, ivPtr, outPtr, outLenPtr, 0, 0,
    );
    if (status !== 0) throw new Error(`decrypt_chunks_parallel failed: ${status}`);
    const outLen = _readU32(outLenPtr);
    const resultData = _readBytes(outPtr, outLen);
    const results = _deserializeChunks(resultData);
    _dealloc(inputPtr, serialized.length);
    _dealloc(keyPtr, 32);
    _dealloc(ivPtr, 24);
    _dealloc(outPtr, outLen);
    _dealloc(outLenPtr, 4);
    return results;
}

export function wasmEncryptAll(records: Uint8Array[], key: Uint8Array): Uint8Array[] {
    const serialized = _serializeChunks(records);
    const inputPtr = _alloc(serialized.length);
    const keyPtr = _alloc(32);
    const outPtr = _alloc(serialized.length * 2);
    const outLenPtr = _alloc(4);
    _writeBytes(inputPtr, serialized);
    _writeBytes(keyPtr, key);
    const status = (_getExports().wasm_encrypt_all as any)(inputPtr, serialized.length, keyPtr, outPtr, outLenPtr);
    if (status !== 0) throw new Error(`encrypt_all failed: ${status}`);
    const outLen = _readU32(outLenPtr);
    const resultData = _readBytes(outPtr, outLen);
    const results = _deserializeChunks(resultData);
    _dealloc(inputPtr, serialized.length);
    _dealloc(keyPtr, 32);
    _dealloc(outPtr, outLen);
    _dealloc(outLenPtr, 4);
    return results;
}

export function wasmDecryptAll(records: Uint8Array[], key: Uint8Array): Uint8Array[] {
    const serialized = _serializeChunks(records);
    const inputPtr = _alloc(serialized.length);
    const keyPtr = _alloc(32);
    const outPtr = _alloc(serialized.length * 2);
    const outLenPtr = _alloc(4);
    _writeBytes(inputPtr, serialized);
    _writeBytes(keyPtr, key);
    const status = (_getExports().wasm_decrypt_all as any)(inputPtr, serialized.length, keyPtr, outPtr, outLenPtr);
    if (status !== 0) throw new Error(`decrypt_all failed: ${status}`);
    const outLen = _readU32(outLenPtr);
    const resultData = _readBytes(outPtr, outLen);
    const results = _deserializeChunks(resultData);
    _dealloc(inputPtr, serialized.length);
    _dealloc(keyPtr, 32);
    _dealloc(outPtr, outLen);
    _dealloc(outLenPtr, 4);
    return results;
}

// ============================================================================
// SDK-level upload/download
// ============================================================================

export async function upload(
    files: { name: string; data: Uint8Array }[],
    password: string,
): Promise<Uint8Array> {
    const serialized = _serializeFiles(files);
    const pwd = new TextEncoder().encode(password);
    const inputPtr = _alloc(serialized.length);
    const pwdPtr = _alloc(pwd.length);
    const outPtr = _alloc(serialized.length * 4);
    const outLenPtr = _alloc(4);
    _writeBytes(inputPtr, serialized);
    _writeBytes(pwdPtr, pwd);
    const status = (_getExports().wasm_upload as any)(
        inputPtr, serialized.length, pwdPtr, pwd.length,
        outPtr, outLenPtr, 0, 0,
    );
    if (status !== 0) throw new Error(`upload failed: ${status}`);
    const outLen = _readU32(outLenPtr);
    const result = _readBytes(outPtr, outLen);
    _dealloc(inputPtr, serialized.length);
    _dealloc(pwdPtr, pwd.length);
    _dealloc(outPtr, outLen);
    _dealloc(outLenPtr, 4);
    return result;
}

export async function download(
    bundle: Uint8Array,
    password: string,
): Promise<SevenEntry[]> {
    const pwd = new TextEncoder().encode(password);
    const bundlePtr = _alloc(bundle.length);
    const pwdPtr = _alloc(pwd.length);
    const outPtr = _alloc(bundle.length * 2);
    const outLenPtr = _alloc(4);
    _writeBytes(bundlePtr, bundle);
    _writeBytes(pwdPtr, pwd);
    const status = (_getExports().wasm_download as any)(
        bundlePtr, bundle.length, pwdPtr, pwd.length,
        outPtr, outLenPtr, 0, 0,
    );
    if (status !== 0) throw new Error(`download failed: ${status}`);
    const outLen = _readU32(outLenPtr);
    const resultData = _readBytes(outPtr, outLen);
    const entries = _deserializeFiles(resultData);
    _dealloc(bundlePtr, bundle.length);
    _dealloc(pwdPtr, pwd.length);
    _dealloc(outPtr, outLen);
    _dealloc(outLenPtr, 4);
    return entries;
}

export async function uploadData(data: Uint8Array, password: string): Promise<string> {
    const pwd = new TextEncoder().encode(password);
    const dataPtr = _alloc(data.length);
    const pwdPtr = _alloc(pwd.length);
    const outPtr = _alloc(data.length * 4);
    const outLenPtr = _alloc(4);
    _writeBytes(dataPtr, data);
    _writeBytes(pwdPtr, pwd);
    const status = (_getExports().wasm_upload_data as any)(
        dataPtr, data.length, pwdPtr, pwd.length,
        outPtr, outLenPtr, 0, 0,
    );
    if (status !== 0) throw new Error(`upload_data failed: ${status}`);
    const outLen = _readU32(outLenPtr);
    const resultBytes = _readBytes(outPtr, outLen);
    const result = new TextDecoder().decode(resultBytes);
    _dealloc(dataPtr, data.length);
    _dealloc(pwdPtr, pwd.length);
    _dealloc(outPtr, outLen);
    _dealloc(outLenPtr, 4);
    return result;
}

export async function downloadData(bundleJson: string, password: string): Promise<Uint8Array> {
    const jsonBytes = new TextEncoder().encode(bundleJson);
    const pwd = new TextEncoder().encode(password);
    const jsonPtr = _alloc(jsonBytes.length);
    const pwdPtr = _alloc(pwd.length);
    const outPtr = _alloc(jsonBytes.length * 4);
    const outLenPtr = _alloc(4);
    _writeBytes(jsonPtr, jsonBytes);
    _writeBytes(pwdPtr, pwd);
    const status = (_getExports().wasm_download_data as any)(
        jsonPtr, jsonBytes.length, pwdPtr, pwd.length,
        outPtr, outLenPtr, 0, 0,
    );
    if (status !== 0) throw new Error(`download_data failed: ${status}`);
    const outLen = _readU32(outLenPtr);
    const result = _readBytes(outPtr, outLen);
    _dealloc(jsonPtr, jsonBytes.length);
    _dealloc(pwdPtr, pwd.length);
    _dealloc(outPtr, outLen);
    _dealloc(outLenPtr, 4);
    return result;
}

// ============================================================================
// Keychain — C ABI handle-based
// ============================================================================

export class WasmKeychain {
    private handle: number = 0;
    private alive: boolean = true;

    constructor() {
        this.handle = (_getExports().keychain_new as any)();
    }

    static fromPassword(password: string): WasmKeychain {
        const kc = new WasmKeychain();
        const pwd = new TextEncoder().encode(password);
        const pwdPtr = _alloc(pwd.length);
        _writeBytes(pwdPtr, pwd);
        const status = (_getExports().keychain_from_password as any)(kc.handle, pwdPtr, pwd.length);
        _dealloc(pwdPtr, pwd.length);
        if (status !== 0) throw new Error(`keychain_from_password failed: ${status}`);
        return kc;
    }

    setPassword(password: string): void {
        const pwd = new TextEncoder().encode(password);
        const pwdPtr = _alloc(pwd.length);
        _writeBytes(pwdPtr, pwd);
        const status = (_getExports().keychain_set_password as any)(this.handle, pwdPtr, pwd.length);
        _dealloc(pwdPtr, pwd.length);
        if (status !== 0) throw new Error(`set_password failed: ${status}`);
    }

    generateSecret(): string {
        const outPtr = _alloc(64);
        const len = (_getExports().keychain_generate_secret as any)(this.handle, outPtr, 64);
        if (len < 0) throw new Error(`generate_secret failed: ${len}`);
        const result = new TextDecoder().decode(_readBytes(outPtr, len));
        _dealloc(outPtr, 64);
        return result;
    }

    encryptMetadata(metadata: string): Uint8Array {
        const data = new TextEncoder().encode(metadata);
        const dataPtr = _alloc(data.length);
        const outPtr = _alloc(data.length * 2);
        const outLenPtr = _alloc(4);
        _writeBytes(dataPtr, data);
        const status = (_getExports().keychain_encrypt_metadata as any)(
            this.handle, dataPtr, data.length, outPtr, outLenPtr,
        );
        if (status !== 0) throw new Error(`encrypt_metadata failed: ${status}`);
        const outLen = _readU32(outLenPtr);
        const result = _readBytes(outPtr, outLen);
        _dealloc(dataPtr, data.length);
        _dealloc(outPtr, outLen);
        _dealloc(outLenPtr, 4);
        return result;
    }

    decryptMetadata(data: Uint8Array): string {
        const dataPtr = _alloc(data.length);
        const outPtr = _alloc(data.length);
        const outLenPtr = _alloc(4);
        _writeBytes(dataPtr, data);
        const status = (_getExports().keychain_decrypt_metadata as any)(
            this.handle, dataPtr, data.length, outPtr, outLenPtr,
        );
        if (status !== 0) throw new Error(`decrypt_metadata failed: ${status}`);
        const outLen = _readU32(outLenPtr);
        const result = new TextDecoder().decode(_readBytes(outPtr, outLen));
        _dealloc(dataPtr, data.length);
        _dealloc(outPtr, outLen);
        _dealloc(outLenPtr, 4);
        return result;
    }

    sign(data: Uint8Array): Uint8Array {
        const dataPtr = _alloc(data.length);
        const outPtr = _alloc(64);
        _writeBytes(dataPtr, data);
        (_getExports().keychain_sign as any)(this.handle, dataPtr, data.length, outPtr);
        const result = _readBytes(outPtr, 64);
        _dealloc(dataPtr, data.length);
        _dealloc(outPtr, 64);
        return result;
    }

    verify(data: Uint8Array, signature: Uint8Array): boolean {
        const dataPtr = _alloc(data.length);
        const sigPtr = _alloc(signature.length);
        _writeBytes(dataPtr, data);
        _writeBytes(sigPtr, signature);
        const result = (_getExports().keychain_verify as any)(
            this.handle, dataPtr, data.length, sigPtr, signature.length,
        );
        _dealloc(dataPtr, data.length);
        _dealloc(sigPtr, signature.length);
        return result === 1;
    }

    exportAuthKey(): Uint8Array {
        const outPtr = _alloc(32);
        (_getExports().keychain_export_auth_key as any)(this.handle, outPtr);
        const result = _readBytes(outPtr, 32);
        _dealloc(outPtr, 32);
        return result;
    }

    salt(): Uint8Array {
        const outPtr = _alloc(32);
        (_getExports().keychain_salt as any)(this.handle, outPtr);
        const result = _readBytes(outPtr, 32);
        _dealloc(outPtr, 32);
        return result;
    }

    ikm(): Uint8Array {
        const outPtr = _alloc(32);
        (_getExports().keychain_ikm as any)(this.handle, outPtr);
        const result = _readBytes(outPtr, 32);
        _dealloc(outPtr, 32);
        return result;
    }

    free(): void {
        if (this.alive && this.handle) {
            (_getExports().keychain_drop as any)(this.handle);
            this.alive = false;
        }
    }

    [Symbol.dispose](): void {
        this.free();
    }
}
