<script lang="ts">
	import { useAuth } from '$lib/queries/auth';

	const { user } = useAuth();

	let { children } = $props();

	$effect(() => {
		console.log(user.data);
	});
</script>

{#if user.isLoading}
	Loading...
{:else}
	{@render children()}
{/if}
