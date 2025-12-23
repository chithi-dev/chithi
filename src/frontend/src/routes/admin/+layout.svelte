<script lang="ts">
	import { goto } from '$app/navigation';
	import { useAuth } from '$lib/queries/auth';

	const { user } = useAuth();

	let { children } = $props();

	$effect(() => {
		if (user.data === null) {
			goto('/login');
		}
	});
</script>

{#if user.isLoading}
	Loading...
{:else}
	{@render children()}
{/if}
