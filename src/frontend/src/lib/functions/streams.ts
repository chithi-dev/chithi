import { WORKER_CONCURRENCY } from '#consts/concurrency';
import { HKDF_IV_STR, HKDF_SALT_STR } from '#consts/encryption';
import ChithiWorker from '#workers/chithi.worker?worker';
import { ZipWriter } from '@zip.js/zip.js';
import { CHUNK_SIZE, argon2Derive, base64url, base64urlToBytes, deriveAESKeyRaw, xorBytes } from './encryption';
import { wasmEncryptChunk, wasmDecryptChunk, wasmGetChunkNonce, ensureInitialized } from '#wasm/chithi_wasm';

const usedNames = new Map<string, number>();
const makeUnique = (name: string) => {
  const count = usedNames.get(name) ?? 0;
  usedNames.set(name, count + 1);
  if (!count) return name;
  const dot = name.lastIndexOf('.');
  return dot > 0 ? `${name.slice(0, dot)}_${count}${name.slice(dot)}` : `${name}_${count}`;
};

const enc = new TextEncoder();
async function deriveSecrets(ikm: Uint8Array, password?: string) {
  let finalIKM = ikm;
  if (password?.length) {
    const salt = new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array([...ikm, ...enc.encode(HKDF_SALT_STR)]))).slice(0, 16);
    finalIKM = xorBytes(ikm, await argon2Derive(enc.encode(password), salt, 32, 16384, 32));
  }
  const hkdfSalt = new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array([...finalIKM, ...enc.encode('aes-key')]))).slice(0, 16);
  const baseIv = new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array([...finalIKM, ...enc.encode(HKDF_IV_STR)]))).slice(0, 24);
  const keyRaw = await deriveAESKeyRaw(finalIKM, hkdfSalt);
  return { keyRaw, baseIv, finalIKM };
}

interface WCtx {
  workers: Worker[]; next: number; results: Map<number, Uint8Array>; qi: number;
  pending: number; doneRes: (() => void) | null; doneRej: ((e: any) => void) | null;
  ended: boolean; ctrl: ReadableStreamDefaultController<Uint8Array> | TransformStreamDefaultController<Uint8Array> | null;
  processed: number; chunkSizes?: Map<number, number>; origSize?: number;
  onProgress?: (p: number, t?: number) => void;
}

type WCtor = new () => Worker;

async function initPool(ctx: WCtx, Ctor: WCtor, keyRaw: Uint8Array, baseIv: Uint8Array, n: number, onMsg: (d: any) => Promise<void>, label: string) {
  const inits = Array.from({ length: n }, (_, i) => new Promise<Worker | null>((res) => {
    try {
      const w = new Ctor();
      let ready = false;
      w.onmessage = (e) => { if (e.data?.type === 'ready' && !ready) { ready = true; res(w); } else onMsg(e.data); };
      w.onerror = () => { if (!ready) { ready = true; console.warn(`${label} ${i} failed.`); res(null); } };
      const [kc, ivc] = [keyRaw.slice(0), baseIv.buffer.slice(0)];
      w.postMessage({ type: 'init', keyRaw: kc, baseIv: ivc }, [kc, ivc]);
    } catch { console.warn(`${label} init failed.`); res(null); }
  }));
  ctx.workers = (await Promise.all(inits)).filter(Boolean) as Worker[];
  if (!ctx.workers.length) console.warn(`All ${label} workers failed. Using main-thread fallback.`);
}

function dispatch(ctx: WCtx, type: 'encrypt' | 'decrypt', idx: number, chunk: Uint8Array) {
  ctx.pending++;
  const buf = chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength);
  ctx.workers[ctx.next].postMessage({ type, index: idx, chunk: buf }, [buf]);
  ctx.next = (ctx.next + 1) % ctx.workers.length;
}

function flush(ctx: WCtx, fallback = 0) {
  while (ctx.results.has(ctx.qi)) {
    const r = ctx.results.get(ctx.qi)!.valueOf() as Uint8Array;
    ctx.results.delete(ctx.qi);
    ctx.ctrl!.enqueue(r);
    ctx.processed += ctx.chunkSizes?.get(ctx.qi) ?? fallback ?? r.byteLength;
    ctx.qi++;
    ctx.onProgress?.(ctx.processed, ctx.origSize);
  }
  if (ctx.ended && !ctx.pending && ctx.doneRes) {
    ctx.onProgress?.(ctx.origSize ?? ctx.processed, ctx.origSize);
    ctx.doneRes();
  }
}

function fail(ctx: WCtx, e: Error) { ctx.doneRej?.(e); ctx.ctrl?.error(e); }

async function proc(ctx: WCtx, idx: number, chunk: Uint8Array, keyRaw: Uint8Array, baseIv: Uint8Array, op: 'encrypt' | 'decrypt') {
  if (ctx.workers.length) { dispatch(ctx, op, idx, chunk); return; }
  ctx.pending++;
  try {
    const nonce = wasmGetChunkNonce(baseIv, idx);
    const encryptFn = op === 'encrypt' ? wasmEncryptChunk : wasmDecryptChunk;
    const result = encryptFn(chunk, keyRaw, nonce);
    ctx.pending--;
    ctx.results.set(idx, result);
    flush(ctx, chunk.byteLength);
  } catch (err) { fail(ctx, err as Error); }
}

async function writeZip(zip: ZipWriter<any>, writable: WritableStream<Uint8Array>, files: File[], password?: string, signal?: AbortSignal) {
  try {
    for (const file of files) {
      let name = (file as any).relativePath || file.name;
      name = makeUnique(name);
      try {
        await zip.add(name, file.stream(), { password, encryptionStrength: password?.length ? 3 : undefined, level: 9, signal });
      } catch (err: any) {
        const msg = String(err?.message || err || '');
        if (msg.includes('exists')) {
          await zip.add(makeUnique(name), file.stream(), { password, encryptionStrength: password?.length ? 3 : undefined, level: 9, signal });
        } else throw err;
      }
    }
    await zip.close();
  } catch (e) { console.error('Error creating zip:', e); writable.abort(e).catch(() => {}); }
}

export async function createZipStream(files: File[], password?: string, signal?: AbortSignal): Promise<ReadableStream<Uint8Array>> {
  const { readable, writable } = new TransformStream();
  const zip = new ZipWriter(writable, { bufferedWrite: true, useCompressionStream: true });
  writeZip(zip, writable, files, password, signal);
  return readable;
}

export async function createEncryptedStream(
  inputStream: ReadableStream<Uint8Array>, password?: string, origSize?: number,
  onProgress?: (p: number, t?: number) => void, ikmOverride?: Uint8Array
) {
  const ikm = ikmOverride ?? crypto.getRandomValues(new Uint8Array(32));
  const { keyRaw, baseIv } = await deriveSecrets(ikm, password);
  const chunks: Uint8Array[] = [], ctx: WCtx = {
    workers: [], next: 0, results: new Map(), qi: 0, pending: 0, doneRes: null, doneRej: null,
    ended: false, ctrl: null, processed: 0, chunkSizes: new Map(), origSize, onProgress,
  };
  let buf = 0;
  const allDone = new Promise<void>((r, j) => { ctx.doneRes = r; ctx.doneRej = j; });

  const read = (size: number) => {
    const out = new Uint8Array(size);
    let off = 0;
    while (off < size) {
      const first = chunks[0]!;
      const take = Math.min(first.length, size - off);
      out.set(first.subarray(0, take), off);
      chunks[0] = take === first.length ? chunks.shift()! : first.subarray(take);
      off += take; buf -= take;
    }
    return out;
  };

  const transformer = new TransformStream<Uint8Array, Uint8Array>({
    async start(controller) {
      ctx.ctrl = controller;
      await ensureInitialized();
      await initPool(ctx, ChithiWorker, keyRaw, baseIv, WORKER_CONCURRENCY,
        async (d) => { if (d?.type === 'encrypted') { ctx.pending--; ctx.results.set(d.index, new Uint8Array(d.encrypted)); flush(ctx); } else fail(ctx, new Error(d?.message || 'Worker error')); },
        'ChithiWorker');
    },
    async transform(chunk) {
      chunks.push(chunk); buf += chunk.length;
      while (buf >= CHUNK_SIZE) { ctx.chunkSizes!.set(ctx.qi, CHUNK_SIZE); await proc(ctx, ctx.qi++, read(CHUNK_SIZE), keyRaw, baseIv, 'encrypt'); }
    },
    async flush() {
      if (buf > 0) { ctx.chunkSizes!.set(ctx.qi, buf); await proc(ctx, ctx.qi++, read(buf), keyRaw, baseIv, 'encrypt'); }
      ctx.ended = true;
      if (ctx.pending > 0) await allDone;
      ctx.workers.forEach(w => { try { w.terminate(); } catch { /* noop */ } });
    },
  });

  return { stream: inputStream.pipeThrough(transformer), keySecret: base64url(ikm) };
}

export async function createDecryptedStream(
  inputStream: ReadableStream<Uint8Array>, keySecret: string, password?: string,
  origSize?: number, onProgress?: (p: number, t?: number) => void
) {
  const { keyRaw, baseIv } = await deriveSecrets(base64urlToBytes(keySecret), password);
  const reader = inputStream.getReader();
  let buffer = new Uint8Array(0);
  const TAG = 16, ECS = CHUNK_SIZE + TAG, ci = { v: 0 };

  const ctx: WCtx = {
    workers: [], next: 0, results: new Map(), qi: 0, pending: 0, doneRes: null, doneRej: null,
    ended: false, ctrl: null, processed: 0, origSize, onProgress,
  };
  const allDone = new Promise<void>((r, j) => { ctx.doneRes = r; ctx.doneRej = j; });
  const term = () => ctx.workers.forEach(w => { try { w.terminate(); } catch { /* noop */ } });
  allDone.then(term).catch(term);

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      ctx.ctrl = controller;
      await ensureInitialized();
      await initPool(ctx, ChithiWorker, keyRaw, baseIv, WORKER_CONCURRENCY,
        async (d) => {
          if (d?.type === 'decrypted') { ctx.pending--; ctx.results.set(d.index, new Uint8Array(d.decrypted)); flush(ctx); }
          else { const err = new Error(d?.message || 'Worker error'); if (d?.name) err.name = d.name; fail(ctx, err); }
        },
        'ChithiWorker');
    },
    async pull(controller) {
      while (buffer.length < ECS) {
        const { done, value } = await reader.read();
        if (done) break;
        const nb = new Uint8Array(buffer.length + value.length);
        nb.set(buffer); nb.set(value, buffer.length);
        buffer = nb;
      }
      if (!buffer.length) {
        if (!ctx.pending) controller.close();
        else { ctx.ended = true; await allDone; controller.close(); }
        return;
      }
      const last = buffer.length < ECS;
      const data = buffer.slice(0, last ? buffer.length : ECS);
      buffer = buffer.slice(last ? buffer.length : ECS);
      await proc(ctx, ci.v++, data, keyRaw, baseIv, 'decrypt');
      if (last && !ctx.pending) { flush(ctx); controller.close(); }
    },
    cancel() { term(); },
  });
}

export function createMultipartStream(
  boundary: string, fields: Record<string, string>, fileField: string,
  filename: string, fileStream: ReadableStream<Uint8Array>
): ReadableStream<Uint8Array> {
  const parts: Uint8Array[] = [];
  for (const [k, v] of Object.entries(fields)) {
    parts.push(enc.encode(`--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`));
  }
  parts.push(enc.encode(`--${boundary}\r\nContent-Disposition: form-data; name="${fileField}"; filename="${filename}"\r\nContent-Type: application/octet-stream\r\n\r\n`));
  const post = enc.encode(`\r\n--${boundary}--\r\n`);

  let phase: 0 | 1 | 2 | 3 = 0;
  let pi = 0;
  let fileReader: ReadableStreamDefaultReader<Uint8Array> | null = null;

  return new ReadableStream({
    async pull(controller) {
      for (;;) {
        if (phase === 0) {
          if (pi < parts.length) { controller.enqueue(parts[pi++]); return; }
          phase = 1; fileReader = fileStream.getReader();
          continue;
        }
        if (phase === 1) {
          const { done, value } = await fileReader!.read();
          if (done) { phase = 2; continue; }
          controller.enqueue(value);
          return;
        }
        if (phase === 2) { controller.enqueue(post); phase = 3; return; }
        controller.close();
        return;
      }
    },
    cancel() { fileReader?.cancel() ?? fileStream.cancel(); },
  });
}
