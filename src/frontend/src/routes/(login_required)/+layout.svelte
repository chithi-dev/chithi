<script lang="ts">
	import { goto } from '$app/navigation';
	import { useAuth } from '$lib/queries/auth';
	import { page } from '$app/state';

	const { isAuthenticated, user } = useAuth();

	let { children } = $props();

	$effect(() => {
		if (!isAuthenticated()) {
			goto(`/login?next=${page.url.pathname}`);
		}
	});
</script>

{#if user.isLoading}
	Loading...
{:else if user.data === null}
	Login Required
{:else}
	{@render children()}
{/if}
