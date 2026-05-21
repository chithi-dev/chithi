<script lang="ts">
	import OGLayout from '../OGLayout.svelte';

	let { filename, size, domain } = $props<{
		filename?: string | null;
		size?: string | null;
		domain?: string | null;
	}>();

	const displayFilename = $derived((filename?.trim() || 'Encrypted File').slice(0, 42));
	const displaySize = $derived(size?.trim() || 'Unknown size');
</script>

<OGLayout
	label="Ready to download"
	title={displayFilename}
	subtitle="Size: {displaySize}"
	domain={domain}
/>
