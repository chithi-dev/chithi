import { Api } from '#consts/backend';
import { createQuery, useQueryClient } from '@tanstack/svelte-query';

export type FileInfo = {
	id: string;
	filename: string;
	folder_name?: string;
	size?: number;
	created_at: string;
	expires_at?: string | null;
	expire_after_n_download?: number;
	download_count?: number;
};

export type FilesWithStats = {
	files: FileInfo[];
	total_urls: number;
	total_size: number;
	links_with_download_caps: number;
	max_expires_at?: string | null;
	longest_expiry_file?: FileInfo | null;
};

export const useFilesQuery = () => {
	const queryClient = useQueryClient();
	const query = createQuery(() => ({
		queryKey: ['admin-files'],
		queryFn: async () => {
			const res = await fetch(Api.ADMIN.FILES, {
				credentials: 'include'
			});

			if (!res.ok) {
				if (res.status === 401) {
					throw new Error('Authentication failed');
				}
				throw new Error(`Failed to fetch files: ${res.statusText}`);
			}

			const json = await res.json();

			return json as FilesWithStats;
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
