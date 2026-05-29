import { Api } from '#consts/backend';
import { createDecryptedStream } from '#functions/streams';
import { ZipReader } from '@zip.js/zip.js';

export function saveBlobUrl(blobOrUrl: Blob | string, filename: string) {
  const url = blobOrUrl instanceof Blob ? URL.createObjectURL(blobOrUrl) : blobOrUrl;
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(Object.assign(a, { style: { display: 'none' } }));
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export class PasswordRequiredError extends Error {
  constructor() {
    super('Password required for decryption');
    this.name = 'PasswordRequiredError';
  }
}

export async function downloadAndDecryptFile(slug: string, key: string, password: string, filename: string, fileSize: number, onProgress: (percent: number) => void) {
  const res = await fetch(Api.DOWNLOAD(slug));
  if (!res.ok) throw new Error('Download failed');
  if (!res.body) throw new Error('No response body');

  let loaded = 0;
  const reader = res.body.getReader();
  const withProgress = new ReadableStream({
    pull(controller) {
      return reader.read().then(({ done, value }) => {
        if (done) { controller.close(); return; }
        loaded += value.byteLength;
        if (fileSize > 0) onProgress(Math.round((loaded / fileSize) * 100));
        controller.enqueue(value);
      });
    },
    cancel: reason => reader.cancel(reason)
  });

  const { stream } = await createDecryptedStream(withProgress, key, password);
  const decReader = stream.getReader();
  let firstChunk: Uint8Array | undefined;
  let isDone = false;

  try {
    const { done, value } = await decReader.read();
    isDone = done;
    if (!done) firstChunk = value;
  } catch (e: unknown) {
    if ((e as any)?.name === 'OperationError') {
      await reader.cancel('Wrong password');
      throw new PasswordRequiredError();
    }
    throw e;
  }

  const verified = new ReadableStream({
    start(controller) {
      if (firstChunk) controller.enqueue(firstChunk);
      if (isDone) controller.close();
    },
    pull(controller) {
      return decReader.read().then(({ done, value }) => {
        if (done) { controller.close(); return; }
        controller.enqueue(value);
      });
    },
    cancel: reason => decReader.cancel(reason)
  });

  const zipReader = new ZipReader(verified);
  let entries;
  try { entries = await zipReader.getEntries(); } catch (err) { await zipReader.close(); throw err; }

  const firstEntry = entries.find((e: any) => !e.directory);
  if (!firstEntry) { await zipReader.close(); throw new Error('No files found in the archive'); }

  const downloadName = firstEntry.filename.split(/[/\\]/).pop() || firstEntry.filename;
  const { readable, writable } = new TransformStream();
  firstEntry.getData(writable, { password: password?.length ? password : undefined })
    .then(() => zipReader.close())
    .catch(err => { console.error('Failed to extract:', err); writable.abort(err); zipReader.close().catch(() => undefined); });

  const chunks = await Array.fromAsync(readable);
  const blob = new Blob(chunks as BlobPart[]);

  if ('showSaveFilePicker' in window) {
    const handle = await (window as any).showSaveFilePicker({ suggestedName: downloadName });
    const w = await (handle as FileSystemFileHandle).createWritable();
    await blob.stream().pipeTo(w);
  } else {
    saveBlobUrl(blob, downloadName);
  }
}
