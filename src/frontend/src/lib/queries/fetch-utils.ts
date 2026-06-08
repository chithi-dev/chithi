import { type QueryClient } from '@tanstack/svelte-query';

export const resolveFetch = (fetch?: typeof globalThis.fetch) => fetch ?? globalThis.fetch;

export async function fetchJson<T>(endpoint: string, label: string, fetchFn?: typeof globalThis.fetch) {
  const fn = resolveFetch(fetchFn);
  const res = await fn(endpoint, { credentials: 'include' });
  if (!res.ok) throw new Error(`Failed to fetch ${label}`);
  return res.json() as Promise<T>;
}

export function prefetch<T>(queryClient: QueryClient, key: string | string[], fn: () => Promise<T>, opts: { staleTime?: number; retry?: boolean } = {}) {
  return queryClient.prefetchQuery({ queryKey: Array.isArray(key) ? key : [key], queryFn: fn, staleTime: opts.staleTime ?? Infinity, retry: opts.retry ?? true });
}
