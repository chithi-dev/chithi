/**
 * Chithi SDK — WASM C ABI wrapper
 *
 * Loads the compiled chithi.wasm module and wraps the C ABI exports
 * in a safe, ergonomic JavaScript API.
 */

let wasmInstance: WasmInstance | null = null;
let wasmReady: Promise<WasmInstance> | null = null;

// ============================================================================
// WASM loader — C ABI interface
// ============================================================================

interface WasmInstance {
  memory: WebAssembly.Memory;
  exports: Record<string, WebAssembly.ExportValue>;
}

function isNode(): boolean {
  return (
    typeof process !== "undefined" &&
    process.versions != null &&
    process.versions.node != null
  );
}

async function loadWasm(): Promise<WasmInstance> {
  if (wasmReady) return wasmReady;

  wasmReady = (async () => {
    const wasmPath = "./chithi.wasm";

    if (isNode()) {
      const fs = await import("node:fs");
      const { fileURLToPath } = await import("node:url");
      const { dirname, join } = await import("node:path");

      const baseDir = dirname(fileURLToPath(import.meta.url));
      const wasmPathResolved = join(baseDir, wasmPath);
      const wasmBytes = fs.readFileSync(wasmPathResolved);
      const { instance } = await WebAssembly.instantiate(wasmBytes, {});
      return { memory: instance.exports.memory as WebAssembly.Memory, exports: instance.exports as any };
    }

    const response = await fetch(wasmPath);
    const buffer = await response.arrayBuffer();
    const { instance } = await WebAssembly.instantiate(buffer, {});
    return { memory: instance.exports.memory as WebAssembly.Memory, exports: instance.exports as any };
  })();

  return wasmReady;
}

// ============================================================================
// Memory helpers — read/write WASM linear memory
// ============================================================================

function getMemory(instance: WasmInstance): Uint8Array {
  return new Uint8Array(instance.memory.buffer);
}

function writeToWasm(instance: WasmInstance, ptr: number, data: Uint8Array): void {
  getMemory(instance).set(data, ptr);
}

function readFromWasm(instance: WasmInstance, ptr: number, len: number): Uint8Array {
  return getMemory(instance).slice(ptr, ptr + len);
}

function alloc(instance: WasmInstance, len: number): number {
  return (instance.exports.chithi_alloc as WebAssembly.Func)(len) as number;
}

function dealloc(instance: WasmInstance, ptr: number, len: number): void {
  (instance.exports.chithi_dealloc as WebAssembly.Func)(ptr, len);
}

// ============================================================================
// File array serialization
// [num_files: u32 BE][name0_len: u32 BE][name0][data0_len: u32 BE][data0]...
// ============================================================================

function serializeFiles(files: { name: string; data: Uint8Array }[]): Uint8Array {
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

function deserializeFiles(data: Uint8Array): { name: string; data: Uint8Array }[] {
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

function serializeChunks(chunks: Uint8Array[]): Uint8Array {
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

function deserializeChunks(data: Uint8Array): Uint8Array[] {
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

// ============================================================================
// High-level API
// ============================================================================

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

function toUint8Array(input: Uint8Array | ArrayBuffer | number[]): Uint8Array {
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (Array.isArray(input)) return new Uint8Array(input);
  throw new TypeError("data must be Uint8Array, ArrayBuffer, or number[]");
}

export class Chithi {
  private _initialized = false;

  async init(): Promise<void> {
    if (this._initialized) return;
    await loadWasm();
    wasmInstance = await loadWasm();
    this._initialized = true;
  }

  private ensure(): void {
    if (!this._initialized || !wasmInstance) {
      throw new Error("Chithi not initialized. Call chithi.init() first.");
    }
  }

  async upload(files: FileEntry[], options: UploadOptions): Promise<EncryptedBundle> {
    this.ensure();
    const wasm = wasmInstance!;
    const normalized = files.map((f) => ({ name: f.name, data: toUint8Array(f.data) }));
    const serialized = serializeFiles(normalized);

    const inputPtr = alloc(wasm, serialized.length);
    const outPtr = alloc(wasm, serialized.length * 4);
    const outLenPtr = alloc(wasm, 4);
    const pwdBytes = new TextEncoder().encode(options.password);

    writeToWasm(wasm, inputPtr, serialized);

    const status = (wasm.exports.wasm_upload as WebAssembly.Func)(
      inputPtr, serialized.length,
      pwdBytes.length > 0 ? alloc(wasm, pwdBytes.length) : 0, pwdBytes.length,
      outPtr, outLenPtr,
      0, 0, // callback_fn, user_data
    ) as number;

    if (pwdBytes.length > 0) dealloc(wasm, inputPtr + serialized.length, pwdBytes.length);

    if (status !== 0) {
      dealloc(wasm, inputPtr, serialized.length);
      dealloc(wasm, outPtr, serialized.length * 4);
      dealloc(wasm, outLenPtr, 4);
      throw new Error(`Upload failed with status ${status}`);
    }

    const view = new DataView(getMemory(wasm).buffer);
    const outLen = view.getUint32(outLenPtr, true);
    const bundle = readFromWasm(wasm, outPtr, outLen);

    dealloc(wasm, inputPtr, serialized.length);
    dealloc(wasm, outPtr, outLen);
    dealloc(wasm, outLenPtr, 4);

    return { bytes: bundle };
  }

  async download(bundle: EncryptedBundle | Uint8Array, options: DownloadOptions): Promise<DownloadResult> {
    this.ensure();
    const wasm = wasmInstance!;
    const bytes = "bytes" in bundle ? bundle.bytes : bundle;
    const pwdBytes = new TextEncoder().encode(options.password);

    const bundlePtr = alloc(wasm, bytes.length);
    const outPtr = alloc(wasm, bytes.length * 2);
    const outLenPtr = alloc(wasm, 4);

    writeToWasm(wasm, bundlePtr, bytes);

    const status = (wasm.exports.wasm_download as WebAssembly.Func)(
      bundlePtr, bytes.length,
      pwdBytes.length > 0 ? alloc(wasm, pwdBytes.length) : 0, pwdBytes.length,
      outPtr, outLenPtr,
      0, 0,
    ) as number;

    if (status !== 0) {
      dealloc(wasm, bundlePtr, bytes.length);
      dealloc(wasm, outPtr, bytes.length * 2);
      dealloc(wasm, outLenPtr, 4);
      throw new Error(`Download failed with status ${status}`);
    }

    const view = new DataView(getMemory(wasm).buffer);
    const outLen = view.getUint32(outLenPtr, true);
    const resultData = readFromWasm(wasm, outPtr, outLen);
    const files = deserializeFiles(resultData);

    dealloc(wasm, bundlePtr, bytes.length);
    dealloc(wasm, outPtr, outLen);
    dealloc(wasm, outLenPtr, 4);

    return { files };
  }
}

export function createChithi(): Chithi {
  return new Chithi();
}

export default Chithi;
