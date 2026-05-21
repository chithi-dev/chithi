<script lang="ts">
	import OGLayout from '../OGLayout.svelte';

	let { title, description, domain } = $props<{
		title?: string | null;
		description?: string | null;
		domain?: string | null;
	}>();

	const displayTitle = $derived((title?.trim() || 'Upload Files').slice(0, 42));
	const displayDescription = $derived(
		(
			description?.trim() || 'Securely upload and share encrypted files with auto-expiring links.'
		).slice(0, 90)
	);
</script>

<OGLayout label="Share Securely" title={displayTitle} subtitle={displayDescription} domain={domain} />
