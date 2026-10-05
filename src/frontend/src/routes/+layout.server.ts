import { checkBackendHealth, prefetchApollo, BACKEND_DOWN_SENTINEL } from '$lib/graphql/server-client';
import {
	OnboardingDocument,
	ConfigDocument,
	InstanceInformationDocument,
	InstanceStatisticsDocument
} from '$lib/graphql/generated/graphql.js';
import type { LayoutServerLoad } from './$types';

/**
 * Root layout server load — the single server-side gate for the whole app.
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
export const load: LayoutServerLoad = async ({ cookies }) => {
	// ── Backend-down gate ─────────────────────────────────────────────────────
	// Probe the backend once per page load. If unreachable, throw a sentinel
	// error that +error.svelte recognizes.
	const backendUp = await checkBackendHealth();
	if (!backendUp) {
		throw new Error(BACKEND_DOWN_SENTINEL);
	}

	const token = cookies.get('access_token');

	// Prefetch the two queries every page needs (Onboarding + Config).
	// Fail-soft: individual query failures are logged and skipped; the client
	// will retry any missing data.
	const __APOLLO__ = await prefetchApollo(token, [
		{ query: OnboardingDocument, label: 'onboarding' },
		{ query: ConfigDocument, label: 'config' },
		{ query: InstanceInformationDocument, label: 'instance-info' },
		{ query: InstanceStatisticsDocument, label: 'instance-stats' }
	]);

	return { token, __APOLLO__ };
};
