/**
 * Serialization helpers for WASM C ABI wire format.
 */

// ============================================================================
// File array serialization
// [num_files: u32 BE][name0_len: u32 BE][name0][data0_len: u32 BE][data0]...
// ============================================================================

export function serializeFiles(
    files: { name: string; data: Uint8Array }[],
): Uint8Array {
    const encoder = new TextEncoder();
    let total = 4;
    for (const f of files) {
        const nameBytes = encoder.encode(f.name);
        total += 4 + nameBytes.length + 4 + f.data.length;
    }
    const result = new Uint8Array(total);
    const view = new DataView(result.buffer);
    view.setUint32(0, files.length);
    let offset = 4;
    for (const f of files) {
        const nameBytes = encoder.encode(f.name);
        view.setUint32(offset, nameBytes.length);
        offset += 4;
        result.set(nameBytes, offset);
        offset += nameBytes.length;
        view.setUint32(offset, f.data.length);
        offset += 4;
        result.set(f.data, offset);
        offset += f.data.length;
    }
    return result;
}

export function deserializeFiles(
    data: Uint8Array,
): { name: string; data: Uint8Array }[] {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const decoder = new TextDecoder();
    let num = view.getUint32(0);
    let offset = 4;
    const results: { name: string; data: Uint8Array }[] = [];
    for (let i = 0; i < num; i++) {
        const nameLen = view.getUint32(offset);
        offset += 4;
        const name = decoder.decode(data.slice(offset, offset + nameLen));
        offset += nameLen;
        const dataLen = view.getUint32(offset);
        offset += 4;
        const fileData = data.slice(offset, offset + dataLen);
        offset += dataLen;
        results.push({ name, data: fileData });
    }
    return results;
}

// ============================================================================
// Chunk array serialization
// [num_chunks: u32 BE][chunk0_len: u32 BE][chunk0]...
// ============================================================================

export function serializeChunks(chunks: Uint8Array[]): Uint8Array {
    let total = 4;
    for (const c of chunks) total += 4 + c.length;
    const result = new Uint8Array(total);
    const view = new DataView(result.buffer);
    view.setUint32(0, chunks.length);
    let offset = 4;
    for (const c of chunks) {
        view.setUint32(offset, c.length);
        offset += 4;
        result.set(c, offset);
        offset += c.length;
    }
    return result;
}

export function deserializeChunks(data: Uint8Array): Uint8Array[] {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const num = view.getUint32(0);
    let offset = 4;
    const results: Uint8Array[] = [];
    for (let i = 0; i < num; i++) {
        const len = view.getUint32(offset);
        offset += 4;
        results.push(data.slice(offset, offset + len));
        offset += len;
    }
    return results;
}
