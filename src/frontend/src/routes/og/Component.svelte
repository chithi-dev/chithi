<script lang="ts">
	import OGLayout from './OGLayout.svelte';
	import { buildOgDisplay, type OgInputs } from './og-display';

	let { kind, label, title, description, filename, size, domain, domainDirection } = $props<
		OgInputs & { domain?: string | null; domainDirection?: 'ltr' | 'rtl' | null }
	>();

	const display = $derived(buildOgDisplay({ kind, label, title, description, filename, size }));
	const displayDomain = $derived(
		(() => {
			const trimmed = domain?.trim() || '';
			if (!trimmed) return '';
			if (/^https?:\/\//i.test(trimmed)) return trimmed.replace(/\/$/, '');
			return `https://${trimmed.replace(/\/$/, '')}`;
		})()
	);
	const titleMask = 'linear-gradient(to right, #000 85%, transparent 100%)';
	const resolvedDomainDirection = $derived(domainDirection === 'rtl' ? 'rtl' : 'ltr');
</script>

<OGLayout
	label={display.label}
	title={display.title}
	subtitle={display.subtitle}
	{displayDomain}
	domainDirection={resolvedDomainDirection}
	{titleMask}
	footerTags={display.footerTags}
/>
