import { createQuery, type QueryClient, useQueryClient } from '@tanstack/svelte-query';

export const resolveFetch = (fetch?: typeof globalThis.fetch) => fetch ?? globalThis.fetch;

/** Fetch JSON from an endpoint with error handling */
export async function fetchJson<T>(endpoint: string, label: string, fetchFn?: typeof globalThis.fetch) {
	const fn = resolveFetch(fetchFn);
	const res = await fn(endpoint, { credentials: 'include' });
	if (!res.ok) throw new Error(`Failed to fetch ${label}`);
	return res.json() as Promise<T>;
}

type QueryOpts = { staleTime?: number; retry?: boolean };

/**
 * Create a shared fetch function for a query.
 * `getter` receives `{ fetch }` and returns a promise — matches TanStack Query's queryFn shape.
 */
export function makeFetcher<T>(endpoint: string, label: string) {
	return async ({ fetch }: { fetch?: typeof globalThis.fetch } = {}) => fetchJson<T>(endpoint, label, fetch);
}

/** Create prefetch + query pair from a shared fetcher */
export function makeQuery<T>(fetcher: () => Promise<T>, key: string | string[], opts: QueryOpts = {}) {
	const { staleTime = Infinity, retry = true } = opts;
	const k = Array.isArray(key) ? key : [key];

	return {
		prefetch: async ({ queryClient, fetch }: { queryClient: QueryClient; fetch?: typeof globalThis.fetch }) =>
			queryClient.prefetchQuery({ queryKey: k, queryFn: () => fetcher(), staleTime, retry }),
		useQuery: () => {
			const qc = useQueryClient();
			const query = createQuery(() => ({ queryKey: k, queryFn: () => fetcher(), staleTime, retry }));
			return { query, qc };
		}
	};
}
