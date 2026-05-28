import type { UploadResult } from '../types';
import { gqlFetch } from '../client';

export const UPLOAD_MUTATION = `
	mutation Upload($filename: String, $expireAfterNDownload: Int!, $numberOfFiles: Int!) {
		upload(filename: $filename, expireAfterNDownload: $expireAfterNDownload, numberOfFiles: $numberOfFiles) {
			key
		}
	}
`;

export const DELETE_FILE_MUTATION = `
	mutation DeleteFile($fileId: ID!) {
		deleteFile(fileId: $fileId) {
			key
		}
	}
`;

export const DOWNLOAD_STREAM_MUTATION = `
	mutation DownloadStream($key: String!) {
		downloadStream(key: $key) {
			filename
			size
		}
	}
`;

export async function uploadFile(
	filename?: string,
	expireAfterNDownload = 10,
	numberOfFiles = 1,
): Promise<UploadResult> {
	return gqlFetch<Partial<UploadResult>>(UPLOAD_MUTATION, { filename, expireAfterNDownload, numberOfFiles });
}

export async function deleteFile(fileId: string): Promise<{ key: string }> {
	return gqlFetch<{ key: string }>(DELETE_FILE_MUTATION, { fileId });
}

export async function downloadStream(key: string): Promise<{ filename: string; size: number }> {
	return gqlFetch<Partial<{ filename: string; size: number }>>(DOWNLOAD_STREAM_MUTATION, { key });
}
