import type { FileOut, FileInfoOut, PaginationInfo } from '../types';
import { gqlFetch } from '../client';

export const GET_FILES = `
	query GetFiles($page: Int!, $pageSize: Int!) {
		files(page: $page, page_size: $pageSize) {
			id
			filename
			size
			expires_at
			expire_after_n_download
			download_count
			created_at
			is_expired
			number_of_files
		}
	}
`;

export const GET_FILE_INFO = `
	query GetFileInfo($key: String!) {
		fileInfo(key: $key) {
			id
			filename
			size
			download_count
			created_at
			expires_at
			expire_after_n_download
			number_of_files
		}
	}
`;

export async function getFiles(page = 1, pageSize = 10): Promise<{ files: FileOut[] }> {
	return gqlFetch<{ files: FileOut[] }>(GET_FILES, { page, pageSize });
}

export async function getFileInfo(key: string): Promise<FileInfoOut | null> {
	return gqlFetch<Partial<FileInfoOut>>(GET_FILE_INFO, { key });
}
