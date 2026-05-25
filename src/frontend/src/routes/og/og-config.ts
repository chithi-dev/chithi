export type OgConfig = {
	label: string;
	title?: string;
	description?: string;
	footerTags?: string[];
	labelFromQuery?: boolean;
	usesFileMeta?: boolean;
};

export const OG_CONFIG = {
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
} satisfies Record<string, OgConfig>;

export type OgKind = keyof typeof OG_CONFIG;

function isOgKind(value: string): value is OgKind {
	return Object.prototype.hasOwnProperty.call(OG_CONFIG, value);
}

export function getOgConfig(kind?: string | null): OgConfig {
	const normalized = kind?.trim().toLowerCase() ?? '';
	if (isOgKind(normalized)) {
		return OG_CONFIG[normalized];
	}

	return OG_CONFIG.base;
}

export function parseOgKind(kind?: string | null): OgKind {
	const normalized = kind?.trim().toLowerCase() ?? '';
	if (isOgKind(normalized)) {
		return normalized;
	}

	return 'base';
}
