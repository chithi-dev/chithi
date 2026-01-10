<script lang="ts">
	import { goto } from '$app/navigation';
	import { useAuth } from '$lib/queries/auth';
	import { page } from '$app/state';

	const { isAuthenticated, user: userData } = useAuth();

	let { children } = $props();

	$effect(() => {
		if (!isAuthenticated()) {
			goto(`/login?next=${page.url.pathname}`);
		}
	});
</script>

{#if userData.isLoading}
	<div class="min-h-screen">Loading...</div>
{:else if [null, undefined].includes(userData.data)}
	Login Required
{:else}
	{@render children()}
{/if}
