/**
 * Chithi SDK — Encrypted file upload/download
 *
 * Uses WebAssembly-backed compression (LZMA2) and encryption (AES-256-GCM)
 * with Argon2id key derivation. Parallel chunk processing via native threads
 * in Node.js (Rayon), via Web Workers in the browser.
 *
 * @example
 * ```ts
 * import { Chithi } from '@chithi/sdk';
 *
 * const chithi = new Chithi();
 * await chithi.init();
 *
 * // Upload
 * const bundle = await chithi.upload(
 *   [{ name: 'file.txt', data: new Uint8Array([1, 2, 3]) }],
 *   'my-password'
 * );
 *
 * // Download
 * const files = await chithi.download(bundle, 'my-password');
 * ```
 */

let wasmModule: WasmAPI | null = null;
let wasmReady: Promise<WasmAPI> | null = null;

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

interface WasmAPI {
  upload(names: string[], datas: Uint8Array[], password: string): Uint8Array;
  download(bundle: Uint8Array, password: string): Array<{ name: string; data: Uint8Array }>;
  uploadData(data: Uint8Array, password: string): string;
  downloadData(bundleJson: string, password: string): Uint8Array;
  wasm_encrypt_chunks_parallel(chunks: Uint8Array[], key: Uint8Array, base_iv: Uint8Array): Uint8Array[];
  wasm_decrypt_chunks_parallel(chunks: Uint8Array[], key: Uint8Array, base_iv: Uint8Array): Uint8Array[];
  wasm_derive_key(password: Uint8Array, salt: Uint8Array): Uint8Array;
  wasm_get_chunk_nonce(base_iv: Uint8Array, chunk_index: number): Uint8Array;
}

function toUint8Array(input: Uint8Array | ArrayBuffer | number[]): Uint8Array {
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (Array.isArray(input)) return new Uint8Array(input);
  throw new TypeError('data must be Uint8Array, ArrayBuffer, or number[]');
}

export class Chithi {
  private _initialized = false;

  /**
   * Initialize the WASM runtime and parallel thread pool.
   *
   * In the browser: spawns Web Workers for parallel chunk encryption.
   * In Node.js: uses native Rayon threads (automatic).
   *
   * @param options - numWorkers sets the parallelism level (default: auto-detect CPU cores)
   */
  async init(options?: { numWorkers?: number }): Promise<void> {
    if (this._initialized) return;
    const wasm = await loadWasm();
    wasmModule = wasm;

    // In the browser, set up Web Worker pool for parallel chunk encryption
    if (!isNode() && options?.numWorkers) {
      workerPoolSize = options.numWorkers;
    }

    this._initialized = true;
  }

  private ensureInitialized(): void {
    if (!this._initialized) {
      throw new Error(
        'Chithi SDK not initialized. Call chithi.init() before upload/download.'
      );
    }
  }

  async upload(
    files: FileEntry[],
    options: UploadOptions
  ): Promise<EncryptedBundle> {
    this.ensureInitialized();
    const wasm = wasmModule!;

    if (!files || files.length === 0) {
      throw new Error('At least one file is required');
    }
    if (!options.password || options.password.length === 0) {
      throw new Error('Password must not be empty');
    }

    const names: string[] = [];
    const datas: Uint8Array[] = [];
    for (const file of files) {
      names.push(file.name);
      datas.push(toUint8Array(file.data));
    }

    const bundle = wasm.upload(names, datas, options.password);
    return { bytes: bundle };
  }

  async download(
    bundle: EncryptedBundle | Uint8Array,
    options: DownloadOptions
  ): Promise<DownloadResult> {
    this.ensureInitialized();
    const wasm = wasmModule!;

    const bytes = 'bytes' in bundle ? bundle.bytes : bundle;
    if (!options.password || options.password.length === 0) {
      throw new Error('Password must not be empty');
    }

    const entries = wasm.download(bytes, options.password);
    const files: FileEntry[] = entries.map((entry) => ({
      name: entry.name,
      data: new Uint8Array(entry.data),
    }));
    return { files };
  }

  async uploadData(
    data: Uint8Array | ArrayBuffer | number[],
    password: string
  ): Promise<string> {
    this.ensureInitialized();
    const wasm = wasmModule!;
    const uint8 = toUint8Array(data);
    return wasm.uploadData(uint8, password);
  }

  async downloadData(
    bundleJson: string,
    password: string
  ): Promise<Uint8Array> {
    this.ensureInitialized();
    const wasm = wasmModule!;
    return wasm.downloadData(bundleJson, password);
  }
}

// ============================================================================
// WASM module loader
// ============================================================================

function isNode(): boolean {
  return (
    typeof process !== 'undefined' &&
    process.versions != null &&
    process.versions.node != null
  );
}

async function loadWasm(): Promise<WasmAPI> {
  if (wasmReady) return wasmReady;

  wasmReady = (async () => {
    const mod = await import('./wasm/wasm_bindings.js');

    if (isNode()) {
      const fs = await import('node:fs');
      const { fileURLToPath } = await import('node:url');
      const { dirname, join } = await import('node:path');

      const baseDir = dirname(fileURLToPath(import.meta.url));
      const wasmPath = join(baseDir, 'wasm', 'wasm_bindings_bg.wasm');
      const wasmBytes = fs.readFileSync(wasmPath);
      const wasmModuleInstance = await WebAssembly.compile(wasmBytes);
      await mod.default({ module_or_path: wasmModuleInstance });
    } else {
      await mod.default();
    }

    return {
      upload: mod.upload,
      download: mod.download,
      uploadData: mod.uploadData,
      downloadData: mod.downloadData,
      wasm_encrypt_chunks_parallel: mod.wasm_encrypt_chunks_parallel,
      wasm_decrypt_chunks_parallel: mod.wasm_decrypt_chunks_parallel,
      wasm_derive_key: mod.wasm_derive_key,
      wasm_get_chunk_nonce: mod.wasm_get_chunk_nonce,
    };
  })();

  return wasmReady;
}

// ============================================================================
// Web Worker parallelism (browser) — uses OffscreenCanvas-style blob workers
// to parallelize chunk encryption across browser threads
// ============================================================================

let workerPoolSize = Math.max(2, (typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : 4));

/**
 * Encrypt multiple chunks in parallel using Web Workers.
 * Each worker processes a batch of chunks via the WASM instance.
 */
async function parallelEncryptChunks(
  chunks: Uint8Array[],
  key: Uint8Array,
  baseIv: Uint8Array,
): Promise<Uint8Array[]> {
  if (isNode() || chunks.length <= 1) {
    // Node.js: Rayon handles parallelism natively
    // Small batches: just do it inline
    return wasmModule!.wasm_encrypt_chunks_parallel(chunks, key, baseIv);
  }

  // Browser: split work across Web Workers
  const results = new Array(chunks.length);
  const batchSizes = distributeWork(chunks.length, workerPoolSize);
  let offset = 0;

  const promises = batchSizes.map(async (size) => {
    const batch = chunks.slice(offset, offset + size);
    offset += size;

    // Each worker gets the WASM module and processes its batch
    const worker = createCryptoWorker();
    try {
      const batchResults = await postToWorker(worker, {
        type: 'encrypt',
        chunks: batch,
        key: key,
        baseIv: baseIv,
      });
      return batchResults as Uint8Array[];
    } finally {
      worker.terminate();
    }
  });

  const allBatches = await Promise.all(promises);
  for (let i = 0; i < allBatches.length; i++) {
    for (let j = 0; j < allBatches[i].length; j++) {
      results[offset - batchSizes[i] + j] = allBatches[i][j];
    }
  }
  return results;
}

function distributeWork(total: number, workers: number): number[] {
  const distribution: number[] = new Array(workers).fill(0);
  for (let i = 0; i < total; i++) {
    distribution[i % workers]++;
  }
  return distribution;
}

function createCryptoWorker(): Worker {
  const workerCode = `
    self.onmessage = async function(e) {
      const { type, chunks, key, baseIv, chunkIndices } = e.data;
      try {
        const wasm = await import('./wasm/wasm_bindings.js');
        await wasm.default();
        if (type === 'encrypt') {
          const results = wasm.wasm_encrypt_chunks_parallel(chunks, key, baseIv);
          self.postMessage({ results, error: null });
        } else if (type === 'decrypt') {
          const results = wasm.wasm_decrypt_chunks_parallel(chunks, key, baseIv);
          self.postMessage({ results, error: null });
        }
      } catch(err) {
        self.postMessage({ results: null, error: err.message });
      }
    };
  `;
  const blob = new Blob([workerCode], { type: 'application/javascript' });
  return new Worker(URL.createObjectURL(blob));
}

async function postToWorker(worker: Worker, data: any): Promise<any> {
  return new Promise((resolve, reject) => {
    worker.onmessage = (e) => {
      if (e.data.error) reject(new Error(e.data.error));
      else resolve(e.data.results);
    };
    worker.onerror = (e) => reject(e);
    worker.postMessage(data);
  });
}

// ============================================================================
// Convenience exports
// ============================================================================

export function createChithi(): Chithi {
  return new Chithi();
}

export default Chithi;
