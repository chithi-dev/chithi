/**
 * Chithi SDK — encrypted file upload/download via WASM C ABI
 *
 * @module chithi-sdk
 */

export { Chithi, createChithi } from './client';
export {
    loadWasm,
    alloc,
    dealloc,
    writeToWasm,
    readFromWasm,
    readU32,
} from './wasm';
export {
    serializeFiles,
    deserializeFiles,
    serializeChunks,
    deserializeChunks,
} from './serialize';
export { toUint8Array } from './types';
export type {
    FileEntry,
    UploadOptions,
    DownloadOptions,
    EncryptedBundle,
    DownloadResult,
} from './types';
