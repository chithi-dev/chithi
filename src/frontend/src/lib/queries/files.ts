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

export type PaginatedFiles = {
	items: FileInfo[];
	total_items: number;
	start_index: number;
	end_index: number;
	total_pages: number;
	current_page: number;
	current_page_size: number;
	meta: {
		total_bytes: number;
		active_urls: number;
		links_with_download_caps: number;
		expiring_soon: number;
		latest_expiry?: number;
	};
};

export const useFilesQuery = (page: () => number = () => 1, pageSize: number = 20) => {
	const queryClient = useQueryClient();
	const query = createQuery(() => ({
		queryKey: ['admin-files', page(), pageSize],
		queryFn: async () => {
			const url = new URL(Api.ADMIN.FILES, window.location.origin);
			url.searchParams.set('page', page().toString());
			url.searchParams.set('page_size', pageSize.toString());

			const res = await fetch(url.toString(), {
				credentials: 'include'
			});

			if (!res.ok) {
				if (res.status === 401) {
					throw new Error('Authentication failed');
				}
				throw new Error(`Failed to fetch files: ${res.statusText}`);
			}
			return res.json() as Promise<PaginatedFiles>;
		},
		refetchInterval: 1000, // 1 second
		retry: true
	}));

	const revokeFile = async (id: string) => {
		const res = await fetch(Api.ADMIN.FILE_REVOKE(id), {
			method: 'DELETE',
			credentials: 'include'
		});

		if (res.ok) {
			await queryClient.invalidateQueries({ queryKey: ['admin-files'] });
		} else {
			throw new Error('Failed to revoke file');
		}
	};

	return {
		files: query,
		revokeFile
	};
};
