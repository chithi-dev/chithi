/**
 * WASM loader — loads chithi.wasm and provides memory helpers.
 */

interface WasmInstance {
    memory: WebAssembly.Memory;
    exports: Record<string, WebAssembly.ExportValue>;
}

type WasmFn = (...args: unknown[]) => unknown;

let wasmInstance: WasmInstance | null = null;
let wasmReady: Promise<WasmInstance> | null = null;

function isNode(): boolean {
    return (
        typeof process !== 'undefined' &&
        process.versions != null &&
        process.versions.node != null
    );
}

export async function loadWasm(): Promise<WasmInstance> {
    if (wasmReady) return wasmReady;

    wasmReady = (async () => {
        const wasmPath = './chithi.wasm';

        if (isNode()) {
            const fs = await import('node:fs');
            const { fileURLToPath } = await import('node:url');
            const { dirname, join } = await import('node:path');

            const baseDir = dirname(fileURLToPath(import.meta.url));
            const wasmPathResolved = join(baseDir, wasmPath);
            const wasmBytes = fs.readFileSync(wasmPathResolved);
            const { instance } = await WebAssembly.instantiate(wasmBytes, {});
            return {
                memory: instance.exports.memory as WebAssembly.Memory,
                exports: instance.exports as any,
            };
        }

        const response = await fetch(wasmPath);
        const buffer = await response.arrayBuffer();
        const { instance } = await WebAssembly.instantiate(buffer, {});
        return {
            memory: instance.exports.memory as WebAssembly.Memory,
            exports: instance.exports as any,
        };
    })();

    return wasmReady;
}

export function getMemory(instance: WasmInstance): Uint8Array {
    return new Uint8Array(instance.memory.buffer);
}

export function writeToWasm(
    instance: WasmInstance,
    ptr: number,
    data: Uint8Array,
): void {
    getMemory(instance).set(data, ptr);
}

export function readFromWasm(
    instance: WasmInstance,
    ptr: number,
    len: number,
): Uint8Array {
    return getMemory(instance).slice(ptr, ptr + len);
}

export function alloc(instance: WasmInstance, len: number): number {
    return (instance.exports.chithi_alloc as WasmFn)(len) as number;
}

export function dealloc(instance: WasmInstance, ptr: number, len: number): void {
    (instance.exports.chithi_dealloc as WasmFn)(ptr, len);
}

export function readU32(instance: WasmInstance, ptr: number): number {
    const view = new DataView(getMemory(instance).buffer);
    return view.getUint32(ptr, true);
}
