import { ADMIN_FILES_URL } from '$lib/consts/backend';
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

export const useFilesQuery = () => {
	const queryClient = useQueryClient();

	const query = createQuery(() => ({
		queryKey: ['admin-files'],
		queryFn: async () => {
			const token = localStorage.getItem('auth_token');
			if (!token) return [];

			const res = await fetch(ADMIN_FILES_URL, {
				headers: {
					Authorization: `Bearer ${token}`
				}
			});

			if (!res.ok) {
				return [];
			}
			return res.json() as Promise<FileInfo[]>;
		},
		staleTime: 1000 * 60, // 1 minute
		retry: false
	}));

	const revokeFile = async (id: string) => {
		const token = localStorage.getItem('auth_token');
		if (!token) throw new Error('Not authenticated');

		const res = await fetch(`${ADMIN_FILES_URL}/${id}`, {
			method: 'DELETE',
			headers: {
				Authorization: `Bearer ${token}`
			}
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
