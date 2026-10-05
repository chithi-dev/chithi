import { checkBackendHealth, prefetchApollo, BACKEND_DOWN_SENTINEL, BACKEND_NOT_CONFIGURED_SENTINEL } from '$lib/graphql/server-client';
import { PUBLIC_BACKEND_API } from '$app/env/public';
import {
	OnboardingDocument,
	ConfigDocument,
	InstanceInformationDocument,
	InstanceStatisticsDocument
} from '$lib/graphql/generated/graphql.js';
import type { LayoutServerLoad } from './$types';

/**
 * Root layout server load - the single server-side gate for the whole app.
 *
 * **1. Backend-down gate.**
 * `checkBackendHealth()` probes the GraphQL endpoint once per page load. If
 * unreachable, we throw a sentinel error that `+error.svelte` recognizes and
 * renders the dedicated "Backend is down" screen. No client-side probe needed.
 *
 * **2. App-wide prefetch.**
 * The two queries every page needs (Onboarding + Config) are prefetched here so
 * the server-rendered HTML already carries their data. Child `+page.server.ts`
 * files can add more via `prefetchApollo` and merge into the same `__APOLLO__`
 * key.
 */
export const load: LayoutServerLoad = async ({ cookies, locals }) => {
	// ── Backend-not-configured gate ───────────────────────────────────────────
	// If PUBLIC_BACKEND_API was never set (e.g. Docker build without the
	// build-arg), there is nothing to reach. Show setup instructions instead
	// of the generic retry screen.
	if (!PUBLIC_BACKEND_API) {
		throw new Error(BACKEND_NOT_CONFIGURED_SENTINEL);
	}

	// ── Backend-down gate ─────────────────────────────────────────────────────
	// Probe the backend once per page load. If unreachable, throw a sentinel
	// error that +error.svelte recognizes.
	const backendUp = await checkBackendHealth();
	if (!backendUp) {
		throw new Error(BACKEND_DOWN_SENTINEL);
	}

	const token = cookies.get('access_token');

	// Prefetch the queries every page needs.
	// Fail-soft: individual query failures are logged and skipped; the client
	// will retry any missing data.
	const __APOLLO__ = await prefetchApollo(token, [
		{ query: OnboardingDocument, label: 'onboarding' },
		{ query: ConfigDocument, label: 'config' },
		{ query: InstanceInformationDocument, label: 'instance-info' },
		{ query: InstanceStatisticsDocument, label: 'instance-stats' }
	]);

	// Expose the session so the root layout can hydrate the auth store.
	// The token is serialized into the HTML as page data; it is the same
	// value the browser would have read from the HttpOnly cookie if it were
	// not HttpOnly - the server is the sole source of truth here.
	const session = locals.session ?? null;

	return { __APOLLO__, session };
};
