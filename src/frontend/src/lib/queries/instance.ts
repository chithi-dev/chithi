import { Api } from '#consts/backend';
import type { QueryClient } from '@tanstack/svelte-query';
import { createQuery } from '@tanstack/svelte-query';

const queryKey = ['instance-information'];
const statisticsQueryKey = ['instance-statistics'];
const FIVE_MINUTES = 1000 * 60 * 5;

const resolveFetch = (fetch?: typeof globalThis.fetch) => fetch ?? globalThis.fetch;

const fetchInstanceInformation = async ({ fetch }: { fetch?: typeof globalThis.fetch } = {}) => {
	const runtimeFetch = resolveFetch(fetch);
	const res = await runtimeFetch(Api.INSTANCE);
	if (!res.ok) throw new Error('Failed to fetch instance information');
	return res.json();
};

const fetchInstanceStatistics = async ({ fetch }: { fetch?: typeof globalThis.fetch } = {}) => {
	const runtimeFetch = resolveFetch(fetch);
	const res = await runtimeFetch(Api.INSTANCE_STATISTICS);
	if (!res.ok) throw new Error('Failed to fetch instance statistics');
	return res.json();
};

export const prefetchInstanceInformation = async ({
	queryClient,
	fetch
}: {
	queryClient: QueryClient;
	fetch?: typeof globalThis.fetch;
}) => {
	await queryClient.prefetchQuery({
		queryKey,
		queryFn: () => fetchInstanceInformation({ fetch }),
		staleTime: FIVE_MINUTES,
		retry: true
	});
};

export const prefetchInstanceStatistics = async ({
	queryClient,
	fetch
}: {
	queryClient: QueryClient;
	fetch?: typeof globalThis.fetch;
}) => {
	await queryClient.prefetchQuery({
		queryKey: statisticsQueryKey,
		queryFn: () => fetchInstanceStatistics({ fetch }),
		staleTime: FIVE_MINUTES,
		retry: true
	});
};

export const useInstanceInformationQuery = () =>
	createQuery(() => ({
		queryKey,
		queryFn: () => fetchInstanceInformation({}),
		staleTime: FIVE_MINUTES
	}));
export const useInstanceStatisticsQuery = () =>
	createQuery(() => ({
		queryKey: statisticsQueryKey,
		queryFn: () => fetchInstanceStatistics({}),
		staleTime: FIVE_MINUTES
	}));
