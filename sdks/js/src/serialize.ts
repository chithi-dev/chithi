/**
 * Serialization helpers for WASM C ABI wire format.
 */

function writeU32BE(view: DataView, offset: number, value: number): number {
    view.setUint32(offset, value);
    return offset + 4;
}

function readU32BE(view: DataView, offset: number): [number, number] {
    return [view.getUint32(offset), offset + 4];
}

// ============================================================================
// File array: [num: u32][nameLen: u32][name][dataLen: u32][data]...
// ============================================================================

export function serializeFiles(files: { name: string; data: Uint8Array }[]): Uint8Array {
    const enc = new TextEncoder();
    const total = 4 + files.reduce((n, f) => n + 4 + enc.encode(f.name).length + 4 + f.data.length, 0);
    const buf = new Uint8Array(total);
    const view = new DataView(buf.buffer);
    let off = writeU32BE(view, 0, files.length);

    for (const f of files) {
        const nb = enc.encode(f.name);
        off = writeU32BE(view, off, nb.length);
        buf.set(nb, off); off += nb.length;
        off = writeU32BE(view, off, f.data.length);
        buf.set(f.data, off); off += f.data.length;
    }
    return buf;
}

export function deserializeFiles(data: Uint8Array): { name: string; data: Uint8Array }[] {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const dec = new TextDecoder();
    let [num, off] = readU32BE(view, 0);
    return Array.from({ length: num }, () => {
        let [nl, o] = readU32BE(view, off);
        const name = dec.decode(data.slice(o, o + nl));
        off = o + nl;
        let [dl, o2] = readU32BE(view, off);
        off = o2 + dl;
        return { name, data: data.slice(o2, off) };
    });
}

// ============================================================================
// Chunk array: [num: u32][len: u32][chunk]...
// ============================================================================

export function serializeChunks(chunks: Uint8Array[]): Uint8Array {
    const total = 4 + chunks.reduce((n, c) => n + 4 + c.length, 0);
    const buf = new Uint8Array(total);
    const view = new DataView(buf.buffer);
    let off = writeU32BE(view, 0, chunks.length);

    for (const c of chunks) {
        off = writeU32BE(view, off, c.length);
        buf.set(c, off); off += c.length;
    }
    return buf;
}

export function deserializeChunks(data: Uint8Array): Uint8Array[] {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    let [num, off] = readU32BE(view, 0);
    return Array.from({ length: num }, () => {
        let [len, o] = readU32BE(view, off);
        off = o + len;
        return data.slice(o, off);
    });
}
