import { Api } from '#consts/backend';
import { createQuery, type QueryClient } from '@tanstack/svelte-query';

import { resolveFetch } from './fetch-utils';

const STALE_TIME = 5 * 60 * 1000;

const fetchJson = async (
	endpoint: string,
	label: string,
	fetchFn?: typeof globalThis.fetch
) => {
	const runtimeFetch = resolveFetch(fetchFn);
	const res = await runtimeFetch(endpoint);
	if (!res.ok) throw new Error(`Failed to fetch ${label}`);
	return res.json();
};

const prefetch = (
	queryClient: QueryClient,
	key: string[],
	fn: () => Promise<unknown>
) =>
	queryClient.prefetchQuery({
		queryKey: key,
		queryFn: fn,
		staleTime: STALE_TIME,
		retry: true
	});

// Information
const infoKey = ['instance-information'];

export const prefetchInstanceInformation = ({
	queryClient,
	fetch
}: {
	queryClient: QueryClient;
	fetch?: typeof globalThis.fetch;
}) => prefetch(queryClient, infoKey, () => fetchJson(Api.INSTANCE, 'instance information', fetch));

export const useInstanceInformationQuery = () =>
	createQuery(() => ({
		queryKey: infoKey,
		queryFn: () => fetchJson(Api.INSTANCE, 'instance information'),
		staleTime: STALE_TIME
	}));

// Statistics
const statsKey = ['instance-statistics'];

export const prefetchInstanceStatistics = ({
	queryClient,
	fetch
}: {
	queryClient: QueryClient;
	fetch?: typeof globalThis.fetch;
}) => prefetch(queryClient, statsKey, () => fetchJson(Api.INSTANCE_STATISTICS, 'instance statistics', fetch));

export const useInstanceStatisticsQuery = () =>
	createQuery(() => ({
		queryKey: statsKey,
		queryFn: () => fetchJson(Api.INSTANCE_STATISTICS, 'instance statistics'),
		staleTime: STALE_TIME
	}));
