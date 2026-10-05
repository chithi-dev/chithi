<script lang="ts">
	// HydrationBoundary — restores a dehydrated Apollo cache into the
	// browser client before its children render.
	//
	// Usage:
	//   <HydrationBoundary state={page.data.__APOLLO__}>
	//     {@render children()}
	//   </HydrationBoundary>
	//
	// How it works:
	//   1. On the client, the $effect below runs hydrateApollo(state)
	//      → client.cache.restore(state.cache).
	//   2. Children call usePrefetchedQuery, which reads from the now-
	//      populated cache — instant render, no network round-trip.
	//   3. If data is stale (> 30 s), usePrefetchedQuery fires a background
	//      refetch (stale-while-revalidate) while the stale data is already
	//      displayed.
	//
	// Server-side: the $effect is client-only. The server renders the children
	// directly (SSR). Nested boundaries are supported — later restore() calls
	// merge into the existing cache.
	import { hydrateApollo } from '$lib/graphql/hydration.svelte.js';
	import type { DehydratedApolloState } from '$lib/graphql/server-client.js';

	let {
		state,
		children
	}: {
		state: DehydratedApolloState | null | undefined;
		children: (() => any) | undefined;
	} = $props();

	$effect(() => {
		if (state) {
			hydrateApollo(state);
		}
	});
</script>

{@render children?.()}
