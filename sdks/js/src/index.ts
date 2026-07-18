/**
 * Chithi SDK — encrypted file upload/download via WASM C ABI
 *
 * @module chithi-sdk
 */

export { Chithi, createChithi } from './client.js';
export { loadWasm, alloc, dealloc, writeToWasm, readFromWasm, readU32 } from './wasm.js';
export { serializeFiles, deserializeFiles, serializeChunks, deserializeChunks } from './serialize.js';
export type { FileEntry, UploadOptions, DownloadOptions, EncryptedBundle, DownloadResult } from './types.js';
export { toUint8Array } from './types.js';
