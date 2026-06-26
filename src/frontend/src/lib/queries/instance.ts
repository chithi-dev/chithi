import { Api } from '#consts/backend';
import { createQuery, type QueryClient, useQueryClient } from '@tanstack/svelte-query';
import { fetchJson, prefetch as prefetchFn } from './fetch-utils';

const STALE = 5 * 60 * 1000; // 5 minutes

export interface InstanceInformation {
	version: string;
	is_release: boolean;
	commit: string;
	python_version: string;
	fastapi_version: string;
	redis_version: string;
	postgres_version: string;
}

export interface InstanceStatistics {
	total_bytes: number;
	total_files: number;
	total_downloads: number;
	active_urls: number;
	active_rooms: number;
	expiring_soon: number;
	latest_expiry: number | null;
	oldest_file: number;
	newest_file: number;
}

// Instance information
const infoKey = ['instance-information'];

export const prefetchInstanceInformation = async ({
	queryClient,
	fetch
}: {
	queryClient: QueryClient;
	fetch?: typeof globalThis.fetch;
}) => {
	await prefetchFn(
		queryClient,
		infoKey,
		() => fetchJson<InstanceInformation>(Api.INSTANCE, 'instance information', fetch),
		{ staleTime: STALE }
	);
};

export const useInstanceInformationQuery = () => {
	const queryClient = useQueryClient();

	const query = createQuery(() => ({
		queryKey: infoKey,
		queryFn: () => fetchJson<InstanceInformation>(Api.INSTANCE, 'instance information'),
		staleTime: STALE
	}));

	return { info: query, queryClient };
};

// Instance statistics
const statsKey = ['instance-statistics'];

export const prefetchInstanceStatistics = async ({
	queryClient,
	fetch
}: {
	queryClient: QueryClient;
	fetch?: typeof globalThis.fetch;
}) => {
	await prefetchFn(
		queryClient,
		statsKey,
		() => fetchJson<InstanceStatistics>(Api.INSTANCE_STATISTICS, 'instance statistics', fetch),
		{ staleTime: STALE }
	);
};

export const useInstanceStatisticsQuery = () => {
	const queryClient = useQueryClient();

	const query = createQuery(() => ({
		queryKey: statsKey,
		queryFn: () => fetchJson<InstanceStatistics>(Api.INSTANCE_STATISTICS, 'instance statistics'),
		staleTime: STALE
	}));

	return { stats: query, queryClient };
};
