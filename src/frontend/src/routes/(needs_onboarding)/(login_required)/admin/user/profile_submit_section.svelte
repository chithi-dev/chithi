<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { Spinner } from '$lib/components/ui/spinner/index.js';
	import { fade } from 'svelte/transition';

	let {
		error,
		success,
		loading
	}: {
		error: string | null;
		success: string | null;
		loading: boolean;
	} = $props();
</script>

<div class="space-y-3 border-t p-4 md:p-6">
	{#if error}
		<div in:fade class="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
			{error}
		</div>
	{/if}
	{#if success}
		<div in:fade class="rounded-md bg-emerald-500/10 p-3 text-sm text-emerald-600">
			{success}
		</div>
	{/if}

	<div class="flex justify-end">
		<Button type="submit" disabled={loading}>
			{#if loading}
				<Spinner />
				Saving...
			{:else}
				Save Changes
			{/if}
		</Button>
	</div>
</div>
