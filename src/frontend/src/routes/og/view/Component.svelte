<script lang="ts">
	import OGLayout from '../OGLayout.svelte';

	let { filename, size } = $props<{
		filename?: string | null;
		size?: string | null;
	}>();

	const displayFilename = $derived((filename?.trim() || 'Encrypted File').slice(0, 42));
	const displaySize = $derived(size?.trim() || 'Unknown size');
</script>

<OGLayout label="Ready to view" title={displayFilename} subtitle="Size: {displaySize}" />
