import { Api } from '#consts/backend';
import { createQuery } from '@tanstack/svelte-query';

const queryKey = ['instance-information'];
const statisticsQueryKey = ['instance-statistics'];

const resolveFetch = (fetch?: typeof globalThis.fetch) => fetch ?? globalThis.fetch;

const fetchInstanceInformation = async ({ fetch }: { fetch?: typeof globalThis.fetch } = {}) => {
	const runtimeFetch = resolveFetch(fetch);
	const res = await runtimeFetch(Api.INSTANCE);
	if (!res.ok) {
		throw new Error('Failed to fetch instance information');
	}
	return res.json();
};

const fetchInstanceStatistics = async ({ fetch }: { fetch?: typeof globalThis.fetch } = {}) => {
	const runtimeFetch = resolveFetch(fetch);
	const res = await runtimeFetch(Api.INSTANCE_STATISTICS);
	if (!res.ok) {
		throw new Error('Failed to fetch instance statistics');
	}
	return res.json();
};

export const prefetchInstanceInformation = async ({
	queryClient,
	fetch
}: {
	queryClient: any;
	fetch: any;
}) => {
	await queryClient.prefetchQuery({
		queryKey: queryKey,
		queryFn: () => fetchInstanceInformation({ fetch }),
		staleTime: 1000 * 60 * 5, // 5 minutes
		retry: true
	});
};

export const prefetchInstanceStatistics = async ({
	queryClient,
	fetch
}: {
	queryClient: any;
	fetch: any;
}) => {
	await queryClient.prefetchQuery({
		queryKey: statisticsQueryKey,
		queryFn: () => fetchInstanceStatistics({ fetch }),
		staleTime: 1000 * 60 * 5, // 5 minutes
		retry: true
	});
};

export const useInstanceInformationQuery = () => {
	return createQuery(() => ({
		queryKey: queryKey,
		queryFn: () => fetchInstanceInformation({}),
		staleTime: 1000 * 60 * 5 // 5 minutes
	}));
};

export const useInstanceStatisticsQuery = () => {
	return createQuery(() => ({
		queryKey: statisticsQueryKey,
		queryFn: () => fetchInstanceStatistics({}),
		staleTime: 1000 * 60 * 5 // 5 minutes
	}));
};
