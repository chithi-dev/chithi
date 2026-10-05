/**
 * Server-side Apollo Client factory - the SvelteKit SSR prefetch bridge.
 *
 * **Pattern (mirrors the platformer's TanStack-style SSR):**
 *
 * ```ts
 * // +page.server.ts
 * import { prefetchApollo } from '$lib/graphql/server-client';
 * import { ConfigDocument } from '$lib/graphql/generated/graphql.js';
 *
 * export const load: PageServerLoad = async ({ cookies }) => {
 *   const __APOLLO__ = await prefetchApollo(cookies.get('access_token'), [
 *     { query: ConfigDocument, label: 'config' },
 *   ]);
 *   return { __APOLLO__ };
 * };
 * ```
 *
 * ```svelte
 * <!-- +layout.svelte -->
 * <HydrationBoundary state={page.data.__APOLLO__}>
 *   {@render children()}
 * </HydrationBoundary>
 * ```
 *
 * The server `load()` runs a real network call from the SvelteKit server to the
 * Django backend (server-to-server, no CORS), populating an InMemoryCache.
 * `dehydrateApollo()` serializes that cache to plain JSON, which SvelteKit ships
 * to the browser as page data. The client's `<HydrationBoundary>` restores it
 * into the browser Apollo cache, and `usePrefetchedQuery` reads the data
 * instantly - no client network round-trip on first paint.
 *
 * **Why a separate factory (not the browser's `client`)?**
 *
 * 1. The browser `client` reads the token from `localStorage`, which is
 *    unavailable during SSR. The server reads it from the `access_token`
 *    cookie instead (set by the login action) and injects it as a Bearer header.
 * 2. `ssrMode: true` tells Apollo to skip `watchQuery` reactivity - the server
 *    only needs one-shot `query()` calls.
 * 3. Keeping the two clients separate means the browser singleton's upload link
 *    (needed for file uploads) is never loaded into server bundles.
 */
import { ApolloClient, InMemoryCache, type DocumentNode } from '@apollo/client';
import { HttpLink } from '@apollo/client/link/http';
import { SetContextLink } from '@apollo/client/link/context';
import { Api } from '#consts/backend';

const GRAPHQL_URL = `${Api.BASE}/graphql/`;

/**
 * The backend-down sentinel.
 *
 * Thrown from `+layout.server.ts` when the Django backend is unreachable (the
 * probe never connects). `+error.svelte` compares the error message against this
 * to render the dedicated "backend is down" message instead of the generic one.
 * A plain string constant so it survives the server→client boundary intact.
 */
export const BACKEND_DOWN_SENTINEL = 'CHITHI_BACKEND_DOWN';

/**
 * Probe the backend by sending a real GraphQL request.
 *
 * Server-only: called from `+layout.server.ts` `load()` on every route load.
 * Uses the same HTTP GraphQL endpoint the rest of the app talks to, so this is
 * a true "can the prefetch path reach the backend" check.
 *
 * The distinction that matters:
 *   - **Network failure** (`fetch` throws - connection refused, DNS, timeout):
 *     the backend is *down*. Return `false`.
 *   - **Any HTTP response** (200 or a GraphQL error body): the backend is
 *     *up* - it answered. A GraphQL error is not "backend down"; the backend
 *     is alive and processing.
 *
 * The timeout keeps a hung backend from stalling the page load.
 */
export async function checkBackendHealth(timeoutMs = 3000): Promise<boolean> {
	try {
		// A trivial, always-valid query. We only care whether the transport
		// connects - not what it returns. `__typename` is valid on any schema.
		await fetch(GRAPHQL_URL, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ query: '{ __typename }' }),
			signal: AbortSignal.timeout(timeoutMs)
		});
		// A response arrived (any status) → the backend is reachable.
		return true;
	} catch {
		// fetch threw (connection refused / timeout / network) → backend down.
		return false;
	}
}

/**
 * Create a server-side Apollo Client for use in SvelteKit `load()` /
 * `+server.ts` handlers.
 *
 * @param accessToken - the JWT (from the `access_token` cookie) to send as
 *   `Authorization: Bearer`. Pass `null`/`undefined` for anonymous queries.
 */
export function createServerApollo(accessToken?: string | null): ApolloClient {
	const authLink = new SetContextLink((_prevCtx, _op) => {
		return accessToken ? { headers: { authorization: `Bearer ${accessToken}` } } : {};
	});

	const httpLink = new HttpLink({ uri: GRAPHQL_URL });

	return new ApolloClient({
		cache: new InMemoryCache(),
		link: authLink.concat(httpLink),
		ssrMode: true // one-shot queries only; no watchQuery reactivity
	});
}

/**
 * The shape of the serialized Apollo cache as it crosses the server→client
 * boundary (SvelteKit page data).
 */
export interface DehydratedApolloState {
	/** The InMemoryCache entity map (plain JSON). */
	cache: Record<string, unknown>;
	/** Unix ms - when the server completed the prefetch. */
	dehydratedAt: number;
}

/**
 * Serialize a server-side Apollo client's cache for transport to the client.
 *
 * Call this after `apollo.query()` has populated the cache, and include the
 * result in the `load()` return value (e.g. `__APOLLO__: dehydrated`).
 *
 * The returned object is plain JSON - safe for SvelteKit page data.
 */
export function dehydrateApollo(apollo: ApolloClient): DehydratedApolloState {
	return {
		cache: apollo.cache.extract() as Record<string, unknown>,
		dehydratedAt: Date.now()
	};
}

/**
 * Prefetch a set of queries into a server Apollo client and return the
 * dehydrated state. Convenience wrapper for the common case of prefetching
 * multiple queries in parallel before serializing.
 *
 * Fail-soft: individual query failures are logged and skipped. The function
 * never throws - the client will retry any missing data.
 */
export async function prefetchApollo(
	accessToken: string | null | undefined,
	queries: Array<{
		query: DocumentNode;
		variables?: Record<string, unknown>;
		/** Label for debug logging. */
		label?: string;
	}>
): Promise<DehydratedApolloState> {
	const apollo = createServerApollo(accessToken);

	await Promise.allSettled(
		queries.map((q) =>
			apollo
				.query({
					query: q.query,
					variables: q.variables,
					// `network-only` on the server: always hit the backend,
					// never a cache hit (the cache is empty on a fresh client
					// anyway, but being explicit avoids surprises).
					fetchPolicy: 'network-only'
				})
				.then((res) => {
					if (import.meta.env.DEV && q.label) {
						console.debug(`[prefetch:server] ${q.label} - ok`);
					}
					return res;
				})
				.catch((e) => {
					if (import.meta.env.DEV) {
						console.debug(`[prefetch:server] ${q.label ?? 'query'} - failed`, e);
					}
					throw e;
				})
		)
	);

	return dehydrateApollo(apollo);
}
