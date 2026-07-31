<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { createQueryStore } from '$lib/graphql/use-query.svelte.js';
	import { OnboardingDocument } from '$lib/graphql/generated/graphql.js';
	import type { OnboardingQuery } from '$lib/graphql/generated/graphql.js';

	const { children } = $props();

	const onboardingQuery = createQueryStore<OnboardingQuery>(OnboardingDocument);

	$effect.pre(() => {
		if (onboardingQuery.fetching || !onboardingQuery.data) return;
		const isOnboardingRoute = page.url.pathname.startsWith('/onboarding');
		const needsOnboarding = !onboardingQuery.data.onboarding.isConfigured;
		if (needsOnboarding && !isOnboardingRoute) {
			goto('/onboarding');
		}
	});
</script>

{@render children()}
