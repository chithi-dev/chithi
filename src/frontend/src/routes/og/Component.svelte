<script lang="ts">
	import OGLayout from './OGLayout.svelte';
	import type { OgDirection, OgSecurity } from './og-enums';

	let { label, title, subtitle, displayDomain, domainDirection, domainSecurity, footerTags } =
		$props<{
			label: string;
			title: string;
			subtitle: string;
			displayDomain: string;
			domainDirection: OgDirection;
			domainSecurity: OgSecurity;
			footerTags?: string[];
		}>();
</script>

<OGLayout
	{label}
	{title}
	{subtitle}
	{displayDomain}
	{domainDirection}
	{domainSecurity}
	{footerTags}
/>
