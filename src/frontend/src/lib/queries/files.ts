import type { QueryClient } from '@tanstack/svelte-query';
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

export type PaginatedFiles = {
	items: FileInfo[];
	total_items: number;
	start_index: number;
	end_index: number;
	total_pages: number;
	current_page: number;
	current_page_size: number;
};

const queryKey = ['admin-files'];

type UseFilesQueryParams = { page: () => number; page_size: number };

export const useFilesQuery = ({ page, page_size }: UseFilesQueryParams) => {
	const queryClient = useQueryClient();
	const query = createQuery(() => ({
		queryKey: [...queryKey, page(), page_size],
		queryFn: async () => {
			const url = new URL(Api.ADMIN.FILES, window.location.origin);
			url.searchParams.set('page', page().toString());
			url.searchParams.set('page_size', page_size.toString());

			const res = await fetch(url.toString(), { credentials: 'include' });

			if (!res.ok) {
				if (res.status === 401) throw new Error('Authentication failed');
				throw new Error(`Failed to fetch files: ${res.statusText}`);
			}
			return res.json() as Promise<PaginatedFiles>;
		},
		refetchInterval: 1_000,
		retry: true
	}));

	const revoke_file = async ({ file_id }: { file_id: string }) => {
		const res = await fetch(Api.ADMIN.FILE_REVOKE(file_id), { credentials: 'include' });

		if (res.ok) {
			await queryClient.invalidateQueries({ queryKey: [...queryKey] });
		} else {
			throw new Error('Failed to revoke file');
		}
	};

	return { files: query, revoke_file };
};
