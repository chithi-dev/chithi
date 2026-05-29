import { Api } from '#consts/backend';
import type { QueryClient } from '@tanstack/svelte-query';
import { createQuery, useQueryClient } from '@tanstack/svelte-query';

const queryKey = ['config'];

const fetchConfig = async (fn = globalThis.fetch) => {
	const res = await fn(Api.CONFIG, { credentials: 'include' });
	return res.json();
};

export const prefetch = async ({ queryClient, fetch }: { queryClient: QueryClient; fetch?: typeof globalThis.fetch }) => {
	await queryClient.prefetchQuery({ queryKey, queryFn: () => fetchConfig(fetch) });
};

type ConfigUpdate = {
	total_storage_limit?: number;
	max_file_size_limit?: number;
	default_expiry?: number;
	default_number_of_downloads?: number;
	site_description?: string;
	download_configs?: number[];
	time_configs?: number[];
	allowed_file_types?: string[];
	banned_file_types?: string[];
	allow_uploads?: boolean;
};

export const useConfigQuery = () => {
	const queryClient = useQueryClient();

	const query = createQuery(() => ({ queryKey, queryFn: () => fetchConfig() }));

	const update_config = async (data: Partial<ConfigUpdate>) => {
		const res = await fetch(Api.ADMIN.CONFIG, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			credentials: 'include',
			body: JSON.stringify(data)
		});
		if (res.ok) await queryClient.invalidateQueries({ queryKey });
	};

	return { config: query, update_config };
};
