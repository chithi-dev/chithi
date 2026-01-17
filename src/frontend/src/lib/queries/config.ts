import { ADMIN_CONFIG_URL, CONFIG_URL } from '$lib/consts/backend';
import { createQuery, useQueryClient } from '@tanstack/svelte-query';

type ConfigIn = {
	// Storage constraints
	total_storage_limit_gb?: number;
	max_file_size_mb?: number;

	// Default constraints
	default_expiry?: number;
	default_number_of_downloads?: number;

	// Markdown
	site_description?: string;

	// Customizable fields
	download_configs?: number[];
	time_configs?: number[];

	// File type restrictions
	allowed_file_types?: string[];
	banned_file_types?: string[];
};

export const useConfigQuery = () => {
	const queryClient = useQueryClient();

	const query = createQuery(() => ({
		queryKey: ['config'],
		queryFn: async () => {
			const token = localStorage.getItem('auth_token');
			let headers: Record<string, string> = {};
			if (token) {
				headers.Authorization = `Bearer ${token}`;
			}

			const res = await fetch(CONFIG_URL, {
				headers: headers
			});

			return res.json();
		},

		staleTime: 10,
		retry: true
	}));

	const update_config = async (data: Partial<ConfigIn>) => {
		const token = localStorage.getItem('auth_token');
		if (!token) return null;

		const res = await fetch(ADMIN_CONFIG_URL, {
			method: 'PATCH',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${token}`
			},
			body: JSON.stringify(data)
		});
		if (res.ok) await queryClient.invalidateQueries({ queryKey: ['config'] });
	};

	return {
		config: query,
		update_config
	};
};
