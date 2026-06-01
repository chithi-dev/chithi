import { Api } from '#consts/backend';
import { createQuery, type QueryClient, useQueryClient } from '@tanstack/svelte-query';

const queryKey = ['config'];
import { resolveFetch } from './fetch-utils';

const fetchConfig = async ({ fetch }: { fetch?: typeof globalThis.fetch }) => {
	const runtimeFetch = resolveFetch(fetch);
	const res = await runtimeFetch(Api.CONFIG, {
		credentials: 'include'
	});

	return res.json();
};

export const prefetch = async ({
	queryClient,
	fetch
}: {
	queryClient: QueryClient;
	fetch?: typeof globalThis.fetch;
}) => {
	await queryClient.prefetchQuery({
		queryKey: queryKey,
		queryFn: () => fetchConfig({ fetch }),
		staleTime: Infinity,
		retry: true
	});
};

type ConfigUpdate = {
	// Storage constraints
	total_storage_limit?: number;
	max_file_size_limit?: number;

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

	// Features
	allow_uploads?: boolean;
};

export const useConfigQuery = () => {
	const queryClient = useQueryClient();

	const query = createQuery(() => ({
		queryKey,
		queryFn: () => fetchConfig({}),
		staleTime: Infinity,
		retry: true
	}));

	const updateConfig = async (data: Partial<ConfigUpdate>) => {
		const res = await fetch(Api.ADMIN.CONFIG, {
			method: 'PATCH',
			headers: {
				'Content-Type': 'application/json'
			},
			credentials: 'include',
			body: JSON.stringify(data)
		});
		if (res.ok) {
			await queryClient.invalidateQueries({ queryKey: ['config'] });
		}
	};

	return {
		config: query,
		updateConfig
	};
};
