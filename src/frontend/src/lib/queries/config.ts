import { ADMIN_CONFIG_URL, CONFIG_URL } from '$lib/consts/backend';
import { createQuery, useQueryClient } from '@tanstack/svelte-query';

const queryKey = ['config'];
const fetchConfig = async ({
	fetch = globalThis.window.fetch
}: {
	fetch?: typeof globalThis.window.fetch;
}) => {
	const res = await fetch(CONFIG_URL);

	return res.json();
};

export const prefetch = async ({ queryClient, fetch }: { queryClient: any; fetch: any }) => {
	await queryClient.prefetchQuery({
		queryKey: queryKey,
		queryFn: () => fetchConfig({ fetch }),
		staleTime: 10,
		retry: true
	});
};

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
	const query = createQuery(() => ({
		queryKey: ['config'],
		queryFn: () => fetchConfig({}),
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
		const queryClient = useQueryClient();

		if (res.ok) await queryClient.invalidateQueries({ queryKey: ['config'] });
	};

	return {
		config: query,
		update_config
	};
};
