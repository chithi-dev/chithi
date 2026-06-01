import { Api } from '#consts/backend';
import { PasswordRequiredError } from '#errors/password';
import { createDecryptedStream } from '#functions/streams';

/** Options for fetchDecryptedBlob */
export interface FetchDecryptOptions {
  /** Override the total size for progress calculation (from Content-Length by default) */
  knownSize?: number;
  /** Called with progress percentage (0-100) as chunks arrive */
  onProgress?: (percent: number) => void;
}

/**
 * Fetch an encrypted file, decrypt it, and return as a Blob.
 * Progress tracked against Content-Length header or knownSize override.
 */
export async function fetchDecryptedBlob(
  slug: string,
  key: string,
  password: string,
  options: FetchDecryptOptions = {}
): Promise<Blob> {
  const res = await fetch(Api.DOWNLOAD(slug));
  if (!res.ok) {
    if (res.status === 404) throw new Error('File not found');
    if (res.status === 410) throw new Error('File expired or limit reached');
    throw new Error('Download failed');
  }
  if (!res.body) throw new Error('No response body');

  const totalSize = options.knownSize
    ?? parseInt(res.headers.get('content-length') ?? '0', 10);

  const sourceStream = options.onProgress && totalSize > 0
    ? wrapProgress(res.body, totalSize, options.onProgress)
    : res.body;

  const { stream: decrypted } = await createDecryptedStream(
    sourceStream,
    key,
    password
  );

  // Read first chunk to catch password errors early
  const reader = decrypted.getReader();
  let firstChunk: Uint8Array | undefined;
  try {
    const { done, value } = await reader.read();
    if (!done) firstChunk = value;
  } catch (e: any) {
    if (e.name === 'OperationError') {
      await reader.cancel('Wrong password');
      throw new PasswordRequiredError();
    }
    throw e;
  }

  // Collect remaining chunks
  const chunks: Uint8Array[] = [];
  if (firstChunk) chunks.push(firstChunk);
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  return new Blob(chunks as BlobPart[], { type: 'application/zip' });
}

/** Wrap a ReadableStream to emit download progress as a percentage. */
function wrapProgress(
  source: ReadableStream<Uint8Array>,
  total: number,
  onProgress: (percent: number) => void
): ReadableStream<Uint8Array> {
  let loaded = 0;
  const srcReader = source.getReader();
  return new ReadableStream({
    async pull(controller) {
      const { done, value } = await srcReader.read();
      if (done) {
        controller.close();
        return;
      }
      loaded += value.byteLength;
      onProgress(Math.round((loaded / total) * 100));
      controller.enqueue(value);
    },
    cancel(reason) {
      return srcReader.cancel(reason);
    }
  });
}
