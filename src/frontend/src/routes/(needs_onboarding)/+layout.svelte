<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { useOnboarding } from '$lib/queries/onboarding';

	let { children } = $props();

	const { status } = useOnboarding();
	let onboarded = $state(false);
	$effect.pre(() => {
		if (status.isLoading || !status.data) return;
		onboarded = status.data.onboarded;

		const isOnboardingRoute = page.url.pathname.startsWith('/onboarding');
		const needsOnboarding = !onboarded;
		if (needsOnboarding && !isOnboardingRoute) {
			goto('/onboarding');
		}
	});
</script>

{#if onboarded || page.url.pathname.startsWith('/onboarding') || status.isLoading}
	{@render children()}
{/if}
