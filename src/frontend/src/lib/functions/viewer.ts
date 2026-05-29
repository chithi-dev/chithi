const TEXT_MIMES = ['text/', 'application/json', 'application/xml', 'text/xml'];

function isTextMime(mime: string) {
  return TEXT_MIMES.some(m => mime.startsWith(m));
}

function looksLikeText(bytes: Uint8Array) {
  let suspicious = 0;
  for (const byte of bytes) {
    if (byte === 0) return false;
    if ((byte < 0x09 || byte > 0x0d) && byte < 0x20) suspicious++;
  }
  return suspicious / bytes.length < 0.1;
}

export async function createViewableText(blob: Blob, _filename: string, mimeHint: string | null = null) {
  const mime = mimeHint ?? blob.type;
  if (mime && isTextMime(mime)) return blob.text();
  const header = new Uint8Array(await blob.slice(0, 2048).arrayBuffer());
  return looksLikeText(header) ? blob.text() : null;
}
