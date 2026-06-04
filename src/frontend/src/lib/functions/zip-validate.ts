const EOCDR_MIN_SIZE = 22;
const EOCDR_SIGNATURE = [0x50, 0x4b, 0x05, 0x06];

/**
 * Validate that a Blob contains a valid ZIP archive structure.
 * Checks minimum size, PK magic bytes, and End of Central Directory Record signature.
 * Throws descriptive errors on failure.
 */
export async function validateZipBlob(blob: Blob): Promise<void> {
  if (blob.size < EOCDR_MIN_SIZE) {
    throw new Error(
      `Decrypted data is too small (${blob.size} bytes) to be a valid archive. The file may be corrupted.`
    );
  }

  const header = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
  if (header[0] !== 0x50 || header[1] !== 0x4b) {
    throw new Error(
      'Decrypted data does not start with ZIP magic bytes. The password may be incorrect or the file is corrupted.'
    );
  }

  const searchSize = Math.min(EOCDR_MIN_SIZE + 65536, blob.size);
  const tail = new Uint8Array(await blob.slice(blob.size - searchSize).arrayBuffer());

  for (let i = tail.length - EOCDR_MIN_SIZE; i >= 0; i--) {
    if (
      tail[i] === EOCDR_SIGNATURE[0] &&
      tail[i + 1] === EOCDR_SIGNATURE[1] &&
      tail[i + 2] === EOCDR_SIGNATURE[2] &&
      tail[i + 3] === EOCDR_SIGNATURE[3]
    ) {
      return;
    }
  }

  throw new Error(
    'Archive structure is incomplete (missing end marker). The file may be corrupted or truncated.'
  );
}

/**
 * Validate a Uint8Array buffer contains a valid ZIP archive structure.
 */
export function validateZipBuffer(data: Uint8Array): void {
  if (data.length < EOCDR_MIN_SIZE) {
    throw new Error(
      `Decrypted data is too small (${data.length} bytes) to be a valid archive. The file may be corrupted.`
    );
  }

  if (data[0] !== 0x50 || data[1] !== 0x4b) {
    throw new Error(
      'Decrypted data does not start with ZIP magic bytes. The password may be incorrect or the file is corrupted.'
    );
  }

  const searchStart = Math.max(0, data.length - EOCDR_MIN_SIZE - 65536);
  for (let i = data.length - EOCDR_MIN_SIZE; i >= searchStart; i--) {
    if (
      data[i] === EOCDR_SIGNATURE[0] &&
      data[i + 1] === EOCDR_SIGNATURE[1] &&
      data[i + 2] === EOCDR_SIGNATURE[2] &&
      data[i + 3] === EOCDR_SIGNATURE[3]
    ) {
      return;
    }
  }

  throw new Error(
    'Archive structure is incomplete (missing end marker). The file may be corrupted or truncated.'
  );
}
