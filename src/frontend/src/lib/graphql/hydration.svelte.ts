/**
 * Client-side Apollo cache hydration + reactive query — the browser half of
 * the SSR prefetch pattern.
 *
 * **Flow:**
 *
 * ```
 * Server +page.server.ts / +layout.server.ts
 *   ├─ prefetchApollo(token, [query, vars, label])
 *   └─ return { __APOLLO__: dehydrated }
 *
 * Client +layout.svelte
 *   └─ <HydrationBoundary state={page.data.__APOLLO__}>
 *        └─ +page.svelte
 *             └─ usePrefetchedQuery(QueryDoc, vars)
 *                  ├─ $effect reads the hydrated cache → instant first paint
 *                  └─ if stale → background refetch (SWR)
 * ```
 *
 * **Why a $effect (not a one-shot sync read)?**
 *
 * The first render happens before the HydrationBoundary's $effect has restored
 * the cache into the browser Apollo client. A synchronous `cache.readQuery` at
 * setup time therefore misses the data and falls through to a network fetch —
 * causing a "No data yet → data" flash.
 *
 * A $effect that reads `apollo.cache` is reactive: it re-runs whenever the
 * cache is mutated (by `hydrateApollo`'s `cache.restore` in the boundary's
 * $effect, or by any subsequent query write). The first run may see an empty
 * cache; the second run (triggered by the restore) sees the data. This
 * eliminates the flash entirely, and also makes the hook reactive to variable
 * changes and to re-hydration after a navigation.
 */
import { page } from '$app/state';
import type { DocumentNode } from '@apollo/client';
import { client } from './client.js';
import type { DehydratedApolloState } from './server-client.js';

// ── Hydration ──────────────────────────────────────────────────────────────

let hydratedState: DehydratedApolloState | null = null;
let hydrated = $state(false);

/**
 * Restore a dehydrated Apollo cache into the browser client.
 *
 * Called by `<HydrationBoundary>` before any `usePrefetchedQuery` $effect runs.
 * Idempotent — a second call with the same state is a no-op.
 */
export function hydrateApollo(state: DehydratedApolloState | null | undefined): void {
	if (!state?.cache) return;
	if (hydrated && hydratedState === state) return; // already restored this exact state
	try {
		client.cache.restore(state.cache);
	} catch (e) {
		console.warn('[hydration] cache.restore failed', e);
	}
	hydratedState = state;
	hydrated = true;
}

/** Whether the cache has been hydrated from server data (at least once). */
export function isHydrated(): boolean {
	return hydrated;
}

/** The timestamp (Unix ms) of the most recent server-side hydration, or null. */
export function dehydratedAt(): number | null {
	return hydratedState?.dehydratedAt ?? null;
}

/** Whether a given dehydrated state is still fresh (within staleTimeMs). */
function isFresh(state: DehydratedApolloState, staleTimeMs: number): boolean {
	return Date.now() - state.dehydratedAt < staleTimeMs;
}

// ── Reactive query ─────────────────────────────────────────────────────────

export interface PrefetchQueryState<TData> {
	data: TData | undefined;
	error: string | null;
	/**
	 * `true` while a network request is in flight AND there is no cached data
	 * to show. If the data was hydrated from the server (even if stale),
	 * `loading` is `false` immediately and the background refetch updates
	 * `data` when it arrives.
	 */
	loading: boolean;
	/** `true` while a background refetch is running (stale-while-revalidate). */
	refetching: boolean;
	/** Manually trigger a refetch (bypasses the cache). */
	refetch: () => Promise<TData | undefined>;
}

/**
 * Svelte 5 runes reactive query with server-hydration awareness.
 *
 * | Cache state | Fresh (< staleTime) | Stale (≥ staleTime) |
 * |---|---|---|
 * | Has data | `loading=false`, no network | `loading=false`, background refetch |
 * | No data | `loading=true`, network | `loading=true`, network |
 *
 * @param documentNode — the precompiled `DocumentNode` from the generated types.
 * @param variables — query variables (or `undefined` for no-arg queries).
 * @param staleTimeMs — freshness window in ms. Default 30 000 (30 s).
 *   Set to `Infinity` to never refetch after hydration.
 */
export function usePrefetchedQuery<
	TData,
	TVars extends Record<string, unknown> = Record<string, unknown>
>(
	documentNode: DocumentNode,
	variables?: TVars,
	staleTimeMs = 30_000,
	skip = false
): PrefetchQueryState<TData> {
	let data = $state<TData | undefined>(undefined);
	let error = $state<string | null>(null);
	let loading = $state(true);
	let refetching = $state(false);

	// Track whether we've ever resolved this (doc, vars) pair from the cache or
	// network — so we don't re-show "loading" on re-runs where data is present.
	let resolvedOnce = false;

	async function fetchNetwork(): Promise<TData | undefined> {
		try {
			const res = await client.query({
				query: documentNode,
				variables,
				fetchPolicy: 'network-only'
			});
			const d = res.data as TData;
			if (d !== undefined) {
				data = d;
				error = null;
			}
			return d;
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
			return undefined;
		} finally {
			loading = false;
			refetching = false;
		}
	}

	/**
	 * Manually refetch (bypasses cache). Sets `refetching` (not `loading`) so
	 * the UI keeps showing the current data while the refetch is in flight.
	 */
	async function refetch(): Promise<TData | undefined> {
		refetching = true;
		return fetchNetwork();
	}

	$effect(() => {
		if (skip) return;

		// Read the reactive runes so Svelte tracks them and re-runs this effect
		// when hydration completes.
		const h = hydrated;
		const hState = hydratedState;

		// The page's dehydrated state (from a server `load()`) — available
		// synchronously on the first client render. If this exists but
		// hydration hasn't happened yet, the HydrationBoundary's $effect is
		// about to restore the cache and trigger a re-run of this effect. In
		// that window we skip the network fetch to avoid a wasted round-trip.
		const pageApollo = (page.data as Record<string, unknown>).__APOLLO__ as
			| DehydratedApolloState
			| undefined;

		// Try to read from the cache first.
		let cached: TData | null = null;
		try {
			cached = client.cache.readQuery({
				query: documentNode,
				variables,
				optimistic: false
			}) as TData | null;
		} catch {
			cached = null;
		}

		if (cached !== null) {
			// Data is in the cache — serve it immediately.
			data = cached;
			error = null;
			loading = false;
			resolvedOnce = true;

			// Stale? Fire a background refetch (SWR) — client-only.
			if (typeof window !== 'undefined' && hState && !isFresh(hState, staleTimeMs)) {
				refetching = true;
				void fetchNetwork().then((d) => {
					if (d !== undefined) data = d;
				});
			}
			return;
		}

		// Cache miss.
		//
		// Case A: page data has __APOLLO__ but hydration hasn't run yet
		// (HydrationBoundary's $effect is queued). Skip the network fetch —
		// the boundary will restore the cache and trigger a re-run of this
		// effect, which will find the data.
		//
		// Case B: no __APOLLO__ in page data (no server prefetch) and we're on
		// the client. Fire a network fetch.
		//
		// Case C: SSR (no window). Do nothing — the server prefetch is the
		// source of truth.
		if (typeof window !== 'undefined') {
			if (pageApollo && !h) {
				// Case A — waiting for hydration.
				return;
			}
			// Case B: cache miss AND the page did not prefetch this query.
			// Warn in dev so developers notice the missing server prefetch.
			if (import.meta.env.DEV && !pageApollo && !resolvedOnce) {
				const opName = (documentNode as { name?: { value?: string } }).name?.value ?? '<anonymous>';
				console.warn(
					`[prefetch] "${opName}" was fetched client-side without a server prefetch. ` +
						`Add this query to a +page.server.ts (prefetchApollo) and hydrate via __APOLLO__ ` +
						`for a faster first paint.`
				);
			}
			if (!resolvedOnce) {
				loading = true;
			} else {
				refetching = true;
			}
			void fetchNetwork();
		}
	});

	return {
		get data() {
			return data;
		},
		get error() {
			return error;
		},
		get loading() {
			return loading;
		},
		get refetching() {
			return refetching;
		},
		refetch
	};
}
