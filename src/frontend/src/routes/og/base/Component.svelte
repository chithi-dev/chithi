<script lang="ts">
	import OGLayout from '../OGLayout.svelte';

	let { title, description, domain } = $props<{
		title?: string | null;
		description?: string | null;
		domain?: string | null;
	}>();

	const displayTitle = $derived((title?.trim() || 'Chithi').slice(0, 42));
	const displayDescription = $derived(
		(
			description?.trim() ||
			'Encrypted file sharing with end-to-end privacy and auto-expiring links'
		).slice(0, 90)
	);
</script>

<OGLayout
	label="Private by design"
	title={displayTitle}
	subtitle={displayDescription}
	domain={domain}
	footerTags={['End-to-end encryption', 'Auto-expiring links', 'Zero-knowledge transfer']}
/>
