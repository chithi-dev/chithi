<script lang="ts">
	import OGLayout from './OGLayout.svelte';

	import type { OgDirection } from './og-enums';

	let { label, title, subtitle, displayDomain, domainDirection, footerTags } = $props<{
		label: string;
		title: string;
		subtitle: string;
		displayDomain: string;
		domainDirection: OgDirection;
		footerTags?: string[];
	}>();
</script>

<OGLayout {label} {title} {subtitle} {displayDomain} {domainDirection} {footerTags} />
