<script lang="ts">
	import OGLayout from './OGLayout.svelte';

	let { label, title, subtitle, displayDomain, domainDirection, footerTags } = $props<{
		label: string;
		title: string;
		subtitle: string;
		displayDomain: string;
		domainDirection: 'ltr' | 'rtl';
		footerTags?: string[];
	}>();
</script>

<OGLayout {label} {title} {subtitle} {displayDomain} {domainDirection} {footerTags} />
