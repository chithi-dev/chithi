import { autoDownload } from '#functions/browser-download';
import { fetchDecryptedBlob } from '#functions/fetch-decrypt';
import { ZipReader } from '@zip.js/zip.js';
import { validateZipBlob } from '#functions/zip-validate';

export async function downloadAndDecryptFile(slug: string, key: string, password: string, filename: string, fileSize: number, _numberOfFiles: number, onProgress: (p: number) => void) {
  const blob = await fetchDecryptedBlob(slug, key, password, { knownSize: fileSize, onProgress });
  await validateZipBlob(blob);

  let stream: ReadableStream = blob.stream();
  let downloadName = filename.toLowerCase().endsWith('.zip') ? filename : `${filename}.zip`;

  const reader = new ZipReader(stream as ReadableStream<Uint8Array>);
  try {
    const entries = await reader.getEntries();
    const entry = entries.find((e) => !e.directory);
    if (!entry) { await reader.close(); throw new Error('No files found in the archive'); }

    downloadName = entry.filename.split(/[/\\]/).pop() || entry.filename;
    const { readable, writable } = new TransformStream();
    entry.getData(writable, { password: password || undefined })
      .then(() => reader.close())
      .catch((err) => { console.error('Failed to extract:', err); writable.abort(err); reader.close().catch(() => undefined); });
    stream = readable;
  } catch (err) { await reader.close(); throw err; }

  const reader2 = stream.getReader();
  const chunks: Uint8Array[] = [];
  for (;;) { const { done, value } = await reader2.read(); if (done) break; chunks.push(value); }
  const extracted = new Blob(chunks as BlobPart[]);

  if ((window as any).showSaveFilePicker) {
    const handle = await (window as any).showSaveFilePicker({ suggestedName: downloadName });
    await extracted.stream().pipeTo(await handle.createWritable());
  } else {
    const url = URL.createObjectURL(extracted);
    autoDownload(url, downloadName);
    URL.revokeObjectURL(url);
  }
}
