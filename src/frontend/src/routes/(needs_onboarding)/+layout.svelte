<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { usePrefetchedQuery } from '$lib/graphql/hydration.svelte.js';
	import { OnboardingDocument } from '$lib/graphql/generated/graphql.js';
	import type { OnboardingQuery } from '$lib/graphql/generated/graphql.js';

	const { children } = $props();

	const onboardingQuery = usePrefetchedQuery<OnboardingQuery>(OnboardingDocument);

	$effect.pre(() => {
		if (onboardingQuery.loading || !onboardingQuery.data) return;
		const isOnboardingRoute = page.url.pathname.startsWith('/onboarding');
		const needsOnboarding = !onboardingQuery.data.onboarding.isConfigured;
		if (needsOnboarding && !isOnboardingRoute) {
			goto('/onboarding');
		}
	});
</script>

{@render children()}
