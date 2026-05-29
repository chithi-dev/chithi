import { Api } from '#consts/backend';
import type { QueryClient } from '@tanstack/svelte-query';
import { createQuery } from '@tanstack/svelte-query';

const infoKey = ['instance-information'];
const statsKey = ['instance-statistics'];
const FIVE_MINUTES = 1000 * 60 * 5;

const fetchInfo = async (fn = globalThis.fetch) => {
	const res = await fn(Api.INSTANCE);
	if (!res.ok) throw new Error('Failed to fetch instance information');
	return res.json();
};

const fetchStats = async (fn = globalThis.fetch) => {
	const res = await fn(Api.INSTANCE_STATISTICS);
	if (!res.ok) throw new Error('Failed to fetch instance statistics');
	return res.json();
};

export const prefetchInstanceInformation = async ({ queryClient, fetch }: { queryClient: QueryClient; fetch?: typeof globalThis.fetch }) => {
	await queryClient.prefetchQuery({ queryKey: infoKey, queryFn: () => fetchInfo(fetch), staleTime: FIVE_MINUTES });
};

export const prefetchInstanceStatistics = async ({ queryClient, fetch }: { queryClient: QueryClient; fetch?: typeof globalThis.fetch }) => {
	await queryClient.prefetchQuery({ queryKey: statsKey, queryFn: () => fetchStats(fetch), staleTime: FIVE_MINUTES });
};

export const useInstanceInformationQuery = () =>
	createQuery(() => ({ queryKey: infoKey, queryFn: () => fetchInfo(), staleTime: FIVE_MINUTES }));

export const useInstanceStatisticsQuery = () =>
	createQuery(() => ({ queryKey: statsKey, queryFn: () => fetchStats(), staleTime: FIVE_MINUTES }));
