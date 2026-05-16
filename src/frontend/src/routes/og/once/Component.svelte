<script lang="ts">
	import OGLayout from '../OGLayout.svelte';

	let { title, description } = $props<{
		title?: string | null;
		description?: string | null;
	}>();

	const displayTitle = $derived((title?.trim() || 'One-time View').slice(0, 42));
	const displayDescription = $derived(
		(
			description?.trim() || 'View your encrypted file once. The link will expire immediately after.'
		).slice(0, 90)
	);
</script>

<OGLayout
	label="Burn After Reading"
	title={displayTitle}
	subtitle={displayDescription}
/>
