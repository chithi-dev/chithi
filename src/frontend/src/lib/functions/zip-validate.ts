import { validate7z, validate7z as validate7zAsync } from '#wasm/chithi_wasm';

const SEVENZ_MAGIC = new Uint8Array([0x37, 0x7A, 0xBC, 0xAF, 0x27, 0x1C]);

function validate(data: Uint8Array): void {
    if (data.length < SEVENZ_MAGIC.length) {
        throw new Error(`Decrypted data is too small (${data.length} bytes) to be a valid archive.`);
    }
    if (!SEVENZ_MAGIC.every((b, i) => data[i] === b)) {
        throw new Error('Decrypted data does not start with 7z magic bytes.');
    }
}

export function validateZipBuffer(data: Uint8Array): void { validate(data); }

export async function validateZipBlob(blob: Blob): Promise<void> {
    const header = new Uint8Array(await blob.slice(0, SEVENZ_MAGIC.length).arrayBuffer());
    if (!SEVENZ_MAGIC.every((b, i) => header[i] === b)) {
        throw new Error('Decrypted data does not start with 7z magic bytes.');
    }
    if (blob.size < SEVENZ_MAGIC.length) {
        throw new Error(`Decrypted data is too small (${blob.size} bytes) to be a valid archive.`);
    }
}
