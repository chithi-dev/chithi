<script lang="ts">
	import OGLayout from '../OGLayout.svelte';

	let { title, description, domain } = $props<{
		title?: string | null;
		description?: string | null;
		domain?: string | null;
	}>();

	const displayTitle = $derived((title?.trim() || 'Network Speedtest').slice(0, 42));
	const displayDescription = $derived(
		(
			description?.trim() ||
			'Test your connection speed to the Chithi server for optimal transfers.'
		).slice(0, 90)
	);
</script>

<OGLayout label="Performance" title={displayTitle} subtitle={displayDescription} domain={domain} />
