/**
 * Data types for the Chithi SDK.
 */

export interface FileEntry {
    name: string;
    data: Uint8Array | ArrayBuffer | number[];
}

export interface UploadOptions {
    password: string;
}

export interface DownloadOptions {
    password: string;
}

export interface EncryptedBundle {
    bytes: Uint8Array;
}

export interface DownloadResult {
    files: FileEntry[];
}

export function toUint8Array(
    input: Uint8Array | ArrayBuffer | number[],
): Uint8Array {
    if (input instanceof Uint8Array) return input;
    if (input instanceof ArrayBuffer) return new Uint8Array(input);
    if (Array.isArray(input)) return new Uint8Array(input);
    throw new TypeError('data must be Uint8Array, ArrayBuffer, or number[]');
}
