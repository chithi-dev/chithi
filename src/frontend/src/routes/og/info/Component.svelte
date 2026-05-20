<script lang="ts">
	import OGLayout from '../OGLayout.svelte';

	let { label, title, description } = $props<{
		label?: string | null;
		title?: string | null;
		description?: string | null;
	}>();

	const displayLabel = $derived(label?.trim() || 'Information');
	const displayTitle = $derived((title?.trim() || 'Chithi Instance').slice(0, 42));
	const displayDescription = $derived(
		(
			description?.trim() || 'System information, statistics, and metadata for this instance.'
		).slice(0, 90)
	);
</script>

<OGLayout label={displayLabel} title={displayTitle} subtitle={displayDescription} />
