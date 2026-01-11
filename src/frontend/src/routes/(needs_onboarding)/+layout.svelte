<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { useOnboarding } from '$lib/queries/onboarding';

	let { children } = $props();

	const { status } = useOnboarding();

	$effect.pre(() => {
		if (status.isLoading || !status.data) return;
		const isOnboardingRoute = page.url.pathname.startsWith('/onboarding');
		const needsOnboarding = !status.data.onboarded;
		if (needsOnboarding && !isOnboardingRoute) {
			goto('/onboarding');
		}
	});
</script>

{@render children()}
