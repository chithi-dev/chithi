/**
 * WASM loader — loads chithi.wasm and provides memory helpers.
 * Browser-only. WASM is loaded at runtime from the shipped .wasm file.
 */

interface WasmInstance {
    memory: WebAssembly.Memory;
    exports: Record<string, WebAssembly.ExportValue>;
}

type WasmFn = (...args: unknown[]) => unknown;

let wasmReady: Promise<WasmInstance> | null = null;

export async function loadWasm(): Promise<WasmInstance> {
    if (wasmReady) return wasmReady;
    wasmReady = WebAssembly.instantiate(
        await fetch(new URL('./chithi.wasm', import.meta.url)).then((r) =>
            r.arrayBuffer(),
        ),
        {},
    ).then(({ instance }) => ({
        memory: instance.exports.memory as WebAssembly.Memory,
        exports: instance.exports as any,
    }));
    return wasmReady;
}

function mem(w: WasmInstance): Uint8Array {
    return new Uint8Array(w.memory.buffer);
}

export function writeToWasm(
    w: WasmInstance,
    ptr: number,
    data: Uint8Array,
): void {
    mem(w).set(data, ptr);
}

export function readFromWasm(
    w: WasmInstance,
    ptr: number,
    len: number,
): Uint8Array {
    return mem(w).slice(ptr, ptr + len);
}

export function alloc(w: WasmInstance, len: number): number {
    return (w.exports.chithi_alloc as WasmFn)(len) as number;
}

export function dealloc(w: WasmInstance, ptr: number, len: number): void {
    (w.exports.chithi_dealloc as WasmFn)(ptr, len);
}

export function readU32(w: WasmInstance, ptr: number): number {
    return new DataView(mem(w).buffer).getUint32(ptr, true);
}
