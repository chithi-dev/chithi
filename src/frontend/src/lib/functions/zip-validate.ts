const SIG = [0x50, 0x4b, 0x05, 0x06];
const MIN = 22;

function validate(data: Uint8Array): void {
  if (data.length < MIN) throw new Error(`Decrypted data is too small (${data.length} bytes) to be a valid archive.`);
  if (data[0] !== 0x50 || data[1] !== 0x4b) throw new Error('Decrypted data does not start with ZIP magic bytes.');
  const start = Math.max(0, data.length - MIN - 65536);
  for (let i = data.length - MIN; i >= start; i--) {
    if (SIG.every((b, j) => data[i + j] === b)) return;
  }
  throw new Error('Archive structure is incomplete (missing end marker).');
}

export function validateZipBuffer(data: Uint8Array): void { validate(data); }

export async function validateZipBlob(blob: Blob): Promise<void> {
  const header = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
  if (header[0] !== 0x50 || header[1] !== 0x4b) throw new Error('Decrypted data does not start with ZIP magic bytes.');
  if (blob.size < MIN) throw new Error(`Decrypted data is too small (${blob.size} bytes) to be a valid archive.`);
  const tail = new Uint8Array(await blob.slice(blob.size - Math.min(MIN + 65536, blob.size)).arrayBuffer());
  for (let i = tail.length - MIN; i >= 0; i--) {
    if (SIG.every((b, j) => tail[i + j] === b)) return;
  }
  throw new Error('Archive structure is incomplete (missing end marker).');
}
