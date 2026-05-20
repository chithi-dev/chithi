<script lang="ts">
	import OGLayout from '../OGLayout.svelte';

	let { title, description } = $props<{
		title?: string | null;
		description?: string | null;
	}>();

	const displayTitle = $derived((title?.trim() || 'Welcome Back').slice(0, 42));
	const displayDescription = $derived(
		(
			description?.trim() || 'Log in to your Chithi instance to manage and share encrypted files.'
		).slice(0, 90)
	);
</script>

<OGLayout label="Authentication" title={displayTitle} subtitle={displayDescription} />
