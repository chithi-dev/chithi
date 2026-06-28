import { Api } from '#consts/backend';
import { PasswordRequiredError } from '#errors/password';
import { createDecryptedStream } from '#functions/streams';

export interface FetchDecryptOptions { knownSize?: number; onProgress?: (percent: number) => void }

export async function fetchDecryptedBlob(slug: string, key: string, password: string, opts: FetchDecryptOptions = {}): Promise<Blob> {
  const res = await fetch(Api.DOWNLOAD(slug));
  if (!res.ok) throw new Error(res.status === 404 ? 'File not found' : res.status === 410 ? 'File expired or limit reached' : 'Download failed');
  if (!res.body) throw new Error('No response body');

  const total = opts.knownSize ?? parseInt(res.headers.get('content-length') ?? '0', 10);
  const src = opts.onProgress && total > 0 ? wrapProgress(res.body, total, opts.onProgress) : res.body;
  const stream = await createDecryptedStream(src, key, password);

  const reader = stream.getReader();
  let first: Uint8Array | undefined;
  try {
    const { done, value } = await reader.read();
    if (!done) first = value;
  } catch (e: any) {
    if (e.name === 'OperationError') { await reader.cancel('Wrong password'); throw new PasswordRequiredError(); }
    throw e;
  }

  const chunks: BlobPart[] = [];
  if (first) chunks.push(first as BlobPart);
  for (;;) { const { done, value } = await reader.read(); if (done) break; chunks.push(value as BlobPart); }
  const blob = new Blob(chunks, { type: 'application/zip' });
  if (chunks.length === 0 || blob.size < 4) throw new Error('Decryption produced no output data');
  return blob;
}

function wrapProgress(src: ReadableStream<Uint8Array>, total: number, onProgress: (p: number) => void): ReadableStream<Uint8Array> {
  let loaded = 0;
  const r = src.getReader();
  return new ReadableStream({
    async pull(c) {
      const { done, value } = await r.read();
      if (done) { c.close(); return; }
      loaded += value.byteLength;
      onProgress(Math.round((loaded / total) * 100));
      c.enqueue(value);
    },
    cancel(reason) { return r.cancel(reason); },
  });
}
