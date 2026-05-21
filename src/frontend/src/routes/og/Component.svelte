<script lang="ts">
	import OGLayout from './OGLayout.svelte';

	type OgConfig = {
		label: string;
		title?: string;
		description?: string;
		footerTags?: string[];
		labelFromQuery?: boolean;
		usesFileMeta?: boolean;
	};

	const OG_CONFIG: Record<string, OgConfig> = {
		base: {
			label: 'Private by design',
			title: 'Chithi',
			description: 'Encrypted file sharing with end-to-end privacy and auto-expiring links',
			footerTags: ['End-to-end encryption', 'Auto-expiring links', 'Zero-knowledge transfer']
		},
		login: {
			label: 'Authentication',
			title: 'Welcome Back',
			description: 'Log in to your Chithi instance to manage and share encrypted files.'
		},
		once: {
			label: 'Burn After Reading',
			title: 'One-time View',
			description: 'View your encrypted file once. The link will expire immediately after.'
		},
		speedtest: {
			label: 'Performance',
			title: 'Network Speedtest',
			description: 'Test your connection speed to the Chithi server for optimal transfers.'
		},
		upload: {
			label: 'Share Securely',
			title: 'Upload Files',
			description: 'Securely upload and share encrypted files with auto-expiring links.'
		},
		info: {
			label: 'Information',
			title: 'Chithi Instance',
			description: 'System information, statistics, and metadata for this instance.',
			labelFromQuery: true
		},
		download: {
			label: 'Ready to download',
			usesFileMeta: true
		},
		view: {
			label: 'Ready to view',
			usesFileMeta: true
		}
	};

	let { kind, label, title, description, filename, size, domain } = $props<{
		kind?: string | null;
		label?: string | null;
		title?: string | null;
		description?: string | null;
		filename?: string | null;
		size?: string | null;
		domain?: string | null;
	}>();

	const normalizedKind = $derived(kind?.trim().toLowerCase() || 'base');
	const config = $derived(OG_CONFIG[normalizedKind as keyof typeof OG_CONFIG] ?? OG_CONFIG.base);

	const displayLabel = $derived(
		config.labelFromQuery ? label?.trim() || config.label : config.label
	);
	const displayTitle = $derived(
		(() => {
			if (config.usesFileMeta) {
				return (filename?.trim() || 'Encrypted File').slice(0, 42);
			}

			return (title?.trim() || config.title || 'Chithi').slice(0, 42);
		})()
	);
	const displaySubtitle = $derived(
		(() => {
			if (config.usesFileMeta) {
				const displaySize = size?.trim() || 'Unknown size';
				return `Size: ${displaySize}`;
			}

			return (description?.trim() || config.description || '').slice(0, 90);
		})()
	);
</script>

<OGLayout
	label={displayLabel}
	title={displayTitle}
	subtitle={displaySubtitle}
	{domain}
	footerTags={config.footerTags}
/>
