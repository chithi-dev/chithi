import { PasswordRequiredError } from '#errors/password';
import { createDecryptedStream } from '#functions/streams';
import { downloadFile } from '#functions/download';

export interface FetchDecryptOptions {
	onProgress?: (percent: number) => void;
}

/**
 * Fetch a file's encrypted bytes (via the chunked S3 pipeline) and decrypt
 * them in memory, returning the plaintext Blob.
 */
export async function fetchDecryptedBlob(slug: string, key: string, password: string, opts: FetchDecryptOptions = {}): Promise<Blob> {
	const { encryptedBlob } = await downloadFile({
		fileId: slug,
		onProgress: opts.onProgress
			? (done, total) => opts.onProgress?.(total > 0 ? Math.round((done / total) * 100) : 0)
			: undefined,
	});

	const stream = await createDecryptedStream(encryptedBlob.stream(), key, password);

	const reader = stream.getReader();
	let first: Uint8Array | undefined;
	try {
		const { done, value } = await reader.read();
		if (!done) first = value;
	} catch (e: any) {
		if (e.name === 'OperationError') {
			await reader.cancel('Wrong password');
			throw new PasswordRequiredError();
		}
		throw e;
	}

	const chunks: BlobPart[] = [];
	if (first) chunks.push(first as unknown as BlobPart);
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		chunks.push(value as unknown as BlobPart);
	}

	const blob = new Blob(chunks, { type: 'application/x-7z-compressed' });
	if (blob.size < 4) throw new Error('Decryption produced no output data');
	return blob;
}
