import {
  ensureInitialized,
  wasmEncryptChunk,
  wasmDecryptChunk,
  wasmGetChunkNonce,
  wasmEncryptChunksParallel,
  wasmDecryptChunksParallel,
  wasmEncryptAll,
  wasmDecryptAll,
  argon2DeriveWasm,
  wasmDeriveKey,
  generateIkmWasm,
  compress7z,
  decompress7z,
  validate7z
} from '#wasm/chithi_wasm';

let keyRaw: Uint8Array | null = null;
let baseIv: Uint8Array | null = null;
let ready = false;

self.onmessage = async (e: MessageEvent) => {
  const msg = e.data as Record<string, unknown>;
  try {
    // --- Initialization ---
    if (msg.type === 'init') {
      if (!ready) {
        await ensureInitialized();
        ready = true;
      }
      keyRaw = new Uint8Array(msg.keyRaw as unknown as ArrayBuffer);
      baseIv = new Uint8Array(msg.baseIv as unknown as ArrayBuffer);
      self.postMessage({ type: 'ready' });
      return;
    }

    if (!ready) {
      self.postMessage({ type: 'error', message: 'WASM not initialized' });
      return;
    }

 // --- Per-chunk encrypt / decrypt (used by stream pipeline) ---
    if (msg.type === 'encrypt' && keyRaw && baseIv) {
      const nonce = wasmGetChunkNonce(baseIv, msg.index as number);
      const result = wasmEncryptChunk(
        new Uint8Array(msg.chunk as unknown as ArrayBuffer),
        keyRaw,
        nonce
      );
      self.postMessage({ type: 'encrypted', index: msg.index, encrypted: result });
      return;
    }

    if (msg.type === 'decrypt' && keyRaw && baseIv) {
      const nonce = wasmGetChunkNonce(baseIv, msg.index as number);
      const result = wasmDecryptChunk(
        new Uint8Array(msg.chunk as unknown as ArrayBuffer),
        keyRaw,
        nonce
      );
      self.postMessage({ type: 'decrypted', index: msg.index, decrypted: result });
      return;
    }

    // --- Parallel chunk operations ---
    if (msg.type === 'encrypt-parallel' && keyRaw && baseIv) {
      const chunks = (msg.chunks as Uint8Array[]).map(c => new Uint8Array(c.buffer ?? new ArrayBuffer(0)));
      const results = wasmEncryptChunksParallel(chunks, keyRaw, baseIv);
      self.postMessage({ type: 'encrypted-batch', results });
      return;
    }

    if (msg.type === 'decrypt-parallel' && keyRaw && baseIv) {
      const chunks = (msg.chunks as Uint8Array[]).map(c => new Uint8Array(c.buffer ?? new ArrayBuffer(0)));
      const results = wasmDecryptChunksParallel(chunks, keyRaw, baseIv);
      self.postMessage({ type: 'decrypted-batch', results });
      return;
    }

    // --- All-at-once encrypt / decrypt ---
    if (msg.type === 'encrypt-all' && keyRaw) {
      const records = [new Uint8Array((msg.data as Uint8Array).buffer ?? new ArrayBuffer(0))];
      const result = wasmEncryptAll(records, keyRaw);
      self.postMessage({ type: 'encrypted-all', encrypted: result });
      return;
    }

    if (msg.type === 'decrypt-all' && keyRaw) {
      const records = [new Uint8Array((msg.data as Uint8Array).buffer ?? new ArrayBuffer(0))];
      const result = wasmDecryptAll(records, keyRaw);
      self.postMessage({ type: 'decrypted-all', decrypted: result });
      return;
    }

    // --- Argon2 key derivation ---
    if (msg.type === 'argon2-derive') {
      const result = argon2DeriveWasm(
        new Uint8Array(msg.password as unknown as ArrayBuffer),
        new Uint8Array(msg.salt as unknown as ArrayBuffer),
        msg.iterations as number,
        msg.memoryCostKib as number,
        msg.hashLength as number
      );
      self.postMessage({ type: 'derived', key: result });
      return;
    }

    // --- WASM key derivation (HKDF-style) ---
    if (msg.type === 'derive-key') {
      const result = wasmDeriveKey(
        new Uint8Array(msg.ikm as unknown as ArrayBuffer),
        new Uint8Array(msg.salt as unknown as ArrayBuffer)
      );
      self.postMessage({ type: 'key-derived', key: result });
      return;
    }

    // --- IKM generation ---
    if (msg.type === 'generate-ikm') {
      const ikm = generateIkmWasm();
      self.postMessage({ type: 'ikm-generated', ikm });
      return;
    }

    // --- 7z compression ---
    if (msg.type === 'compress-7z') {
      const entries = msg.entries as Array<{ name: string; data: Uint8Array }>;
      const result = compress7z(entries, msg.password as string | undefined);
      self.postMessage({ type: 'compressed', data: result });
      return;
    }

    // --- 7z decompression ---
    if (msg.type === 'decompress-7z') {
      const data = new Uint8Array(msg.data as unknown as ArrayBuffer);
      const result = await decompress7z(data, msg.password as string | undefined);
      self.postMessage({ type: 'decompressed', entries: result });
      return;
    }

    // --- 7z validation ---
    if (msg.type === 'validate-7z') {
      const data = new Uint8Array(msg.data as unknown as ArrayBuffer);
      const valid = validate7z(data);
      self.postMessage({ type: 'validated', valid });
      return;
    }

    // --- Unknown message ---
    self.postMessage({ type: 'error', message: `Unknown message type: ${msg.type}` });
  } catch (err) {
    self.postMessage({
      type: 'error',
      message: (err as Error)?.message ?? String(err),
      index: msg.index as number
    });
  }
};
