/**
 * Chunked upload pipeline.
 *
 * Flow:
 *   1. Call `registerFile` mutation → get file key + chunk count
 *   2. Upload each 50 MB chunk via `uploadFileChunk` (multipart GraphQL)
 *   3. Call `completeUpload` to confirm all chunks arrived
 *
 * The 50 MB chunk size must match the backend's `CHUNK_SIZE_BYTES`.
 */
import {
	RegisterFileDocument,
	UploadFileChunkDocument,
	CompleteUploadDocument,
} from '$lib/graphql/generated/graphql.js';
import { client } from '$lib/graphql/client.js';

/** 50 MB — must match the backend's CHUNK_SIZE_BYTES. */
const CHUNK_SIZE = 50 * 1024 * 1024;

export interface UploadFileOptions {
	/** The encrypted file bytes to upload. */
	encryptedData: Blob;
	/** Display name for the file (single file name or folder name). */
	filename: string;
	/** Expiry in seconds. */
	expiresAt: number;
	/** Max download count (1 for view-once). */
	expireAfterNDownload: number;
	/** Number of original files in the zip, or null. */
	numberOfFiles?: number;
	/** Called after each chunk is uploaded: (chunksDone, totalChunks). */
	onProgress?: (chunksDone: number, totalChunks: number) => void;
}

export async function uploadFile(opts: UploadFileOptions): Promise<{ id: string; key: string }> {
	const { encryptedData, filename, expiresAt, expireAfterNDownload, numberOfFiles, onProgress } = opts;

	const totalSize = encryptedData.size;
	const chunkCount = Math.max(1, Math.ceil(totalSize / CHUNK_SIZE));

	// 1. Register the file — creates the DB row and returns the storage key.
	const regResult = await client.mutate<any>({
		mutation: RegisterFileDocument,
		variables: {
			filename,
			totalSize,
			chunkCount,
			expiresAt,
			expireAfterNDownload,
			numberOfFiles: numberOfFiles ?? null,
		},
	});
	if (regResult.error) throw new Error(regResult.error.message);

	const registered = regResult.data.registerFile;
	const fileKey: string = registered.key;

	// 2. Upload each chunk.
	for (let i = 0; i < chunkCount; i++) {
		const start = i * CHUNK_SIZE;
		const end = Math.min(start + CHUNK_SIZE, totalSize);
		const chunkBlob = encryptedData.slice(start, end);
		const isLast = i === chunkCount - 1;

		// Build a File so the multipart encoder picks it up.
		const chunkFile = new File([chunkBlob], `chunk-${i}`, { type: 'application/octet-stream' });

		const uploadResult = await client.mutate<any>({
			mutation: UploadFileChunkDocument,
			variables: {
				fileKey,
				chunkIndex: i,
				chunk: chunkFile,
				isLast,
			},
			context: {
				// Tell apollo-upload-client this is a file variable.
				upload: true,
			},
		});
		if (uploadResult.error) throw new Error(uploadResult.error.message);

		onProgress?.(i + 1, chunkCount);
	}

	// 3. Confirm all chunks arrived.
	const completeResult = await client.mutate<any>({
		mutation: CompleteUploadDocument,
		variables: { fileId: registered.id },
	});
	if (completeResult.error) throw new Error(completeResult.error.message);

	return { id: registered.id, key: fileKey };
}
