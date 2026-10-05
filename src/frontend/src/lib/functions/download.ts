/**
 * Chunked download pipeline.
 *
 * Flow:
 *   1. Query `fileInfo` to get `chunkCount`
 *   2. For each chunk, call the `chunkUrl` mutation → get a presigned URL
 *   3. Fetch each chunk from the presigned URL (bypasses Django)
 *   4. Reassemble all chunks into a single Blob
 *   5. Pass to the decryptor
 *
 * The frontend downloads chunks **directly from S3** (behind Cloudflare),
 * so Django is not in the download hot path.
 */
import {
	FileInfoDocument,
	ChunkUrlDocument,
} from '$lib/graphql/generated/graphql.js';
import { client } from '$lib/graphql/client.js';
import { createDecryptedStream } from '#functions/streams';
import { autoDownload } from '#functions/browser-download';
import { PasswordRequiredError } from '#errors/password';

export interface DownloadFileOptions {
	/** The file slug / UUID (the `key` field from the file record). */
	fileId: string;
	/** Called after each chunk is downloaded: (chunksDone, totalChunks). */
	onProgress?: (chunksDone: number, totalChunks: number) => void;
}

export interface DownloadResult {
	/** The reassembled encrypted blob, ready for decryption. */
	encryptedBlob: Blob;
	/** Original filename from the server. */
	filename: string;
	/** Total size in bytes. */
	size: number;
}

async function getFileInfo(fileId: string): Promise<{
	chunkCount: number;
	filename: string;
	size: number;
	isExpired: boolean;
}> {
	const result = await client.query<any>({
		query: FileInfoDocument,
		variables: { slug: fileId },
	});
	if (result.error) throw new Error(result.error.message);

	const info = result.data.fileInfo;
	if (!info) throw new Error('File not found');
	if (info.isExpired) throw new Error('File has expired');

	return {
		chunkCount: info.chunkCount,
		filename: info.filename,
		size: info.size,
		isExpired: info.isExpired,
	};
}

async function fetchChunk(fileId: string, chunkIndex: number): Promise<Blob> {
	const result = await client.mutate<any>({
		mutation: ChunkUrlDocument,
		variables: { fileId, chunkIndex },
	});
	if (result.error) throw new Error(result.error.message);

	const url: string = result.data.chunkUrl;
	if (!url) throw new Error('No presigned URL returned');

	const res = await fetch(url);
	if (!res.ok) {
		throw new Error(`Chunk ${chunkIndex} download failed (${res.status})`);
	}
	return res.blob();
}

export async function downloadFile(opts: DownloadFileOptions): Promise<DownloadResult> {
	const { fileId, onProgress } = opts;

	const info = await getFileInfo(fileId);
	const { chunkCount, filename, size } = info;

	const chunks: Blob[] = [];
	for (let i = 0; i < chunkCount; i++) {
		const chunkBlob = await fetchChunk(fileId, i);
		chunks.push(chunkBlob);
		onProgress?.(i + 1, chunkCount);
	}

	const encryptedBlob = new Blob(chunks, { type: 'application/octet-stream' });
	return { encryptedBlob, filename, size };
}

/**
 * Download a file (chunked, from S3), decrypt it, and trigger a browser
 * download of the resulting zip.
 */
export async function downloadAndDecryptFile(
	slug: string,
	key: string,
	password: string,
	filename: string,
	_fileSize: number,
	_numberOfFiles: number,
	onProgress?: (percent: number) => void,
): Promise<void> {
	const { encryptedBlob } = await downloadFile({
		fileId: slug,
		onProgress: onProgress
			? (done, total) => onProgress(total > 0 ? Math.round((done / total) * 100) : 0)
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

	const parts: BlobPart[] = [];
	if (first) parts.push(first as unknown as BlobPart);
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		parts.push(value as unknown as BlobPart);
	}

	const blob = new Blob(parts, { type: 'application/x-7z-compressed' });
	if (blob.size < 4) throw new Error('Decryption produced no output data');

	const url = URL.createObjectURL(blob);
	autoDownload(url, filename.toLowerCase().endsWith('.7z') ? filename : `${filename}.7z`);
	URL.revokeObjectURL(url);
}
