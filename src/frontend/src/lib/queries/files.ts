import { Api } from '#consts/backend';
import { createQuery, useQueryClient } from '@tanstack/svelte-query';

export type FileInfo = {
	id: string;
	filename: string;
	folder_name?: string;
	size?: number;
	created_at: string;
	expires_at?: string;
	expire_after_n_download?: number;
	download_count?: number;
};

export type PaginatedFiles = { items: FileInfo[]; total_items: number; start_index: number; end_index: number; total_pages: number; current_page: number; current_page_size: number };

const queryKey = ['admin-files'];

export const useFilesQuery = (page: () => number = () => 1, pageSize = 20) => {
	const qc = useQueryClient();

	const query = createQuery(() => ({
		queryKey: [...queryKey, page(), pageSize],
		queryFn: async () => {
			const url = new URL(Api.ADMIN.FILES, location.origin);
			url.searchParams.set('page', String(page()));
			url.searchParams.set('page_size', String(pageSize));
			const res = await fetch(url, { credentials: 'include' });
			if (!res.ok) throw new Error(res.status === 401 ? 'Authentication failed' : `Failed to fetch files: ${res.statusText}`);
			return res.json() as Promise<PaginatedFiles>;
		},
		refetchInterval: 1000,
		retry: true
	}));

	const revokeFile = async (id: string) => {
		const res = await fetch(Api.ADMIN.FILE_REVOKE(id), { method: 'DELETE', credentials: 'include' });
		if (res.ok) await qc.invalidateQueries({ queryKey });
		else throw new Error('Failed to revoke file');
	};

	return { files: query, revokeFile };
};
