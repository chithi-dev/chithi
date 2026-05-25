import { OgKind } from "./og-enums";

export type OgConfig = {
	label: string;
	title?: string;
	description?: string;
	footerTags?: string[];
	labelFromQuery?: boolean;
	usesFileMeta?: boolean;
};

export const OG_CONFIG: Record<OgKind, OgConfig> = {
	[OgKind.Base]: {
		label: 'Private by design',
		title: 'Chithi',
		description: 'Encrypted file sharing with end-to-end privacy and auto-expiring links',
		footerTags: ['End-to-end encryption', 'Auto-expiring links', 'Zero-knowledge transfer']
	},
	[OgKind.Login]: {
		label: 'Authentication',
		title: 'Welcome Back',
		description: 'Log in to your Chithi instance to manage and share encrypted files.'
	},
	[OgKind.Once]: {
		label: 'Burn After Reading',
		title: 'One-time View',
		description: 'View your encrypted file once. The link will expire immediately after.'
	},
	[OgKind.Speedtest]: {
		label: 'Performance',
		title: 'Network Speedtest',
		description: 'Test your connection speed to the Chithi server for optimal transfers.'
	},
	[OgKind.Upload]: {
		label: 'Share Securely',
		title: 'Upload Files',
		description: 'Securely upload and share encrypted files with auto-expiring links.'
	},
	[OgKind.Info]: {
		label: 'Information',
		title: 'Chithi Instance',
		description: 'System information, statistics, and metadata for this instance.',
		labelFromQuery: true
	},
	[OgKind.Download]: {
		label: 'Ready to download',
		usesFileMeta: true
	},
	[OgKind.View]: {
		label: 'Ready to view',
		usesFileMeta: true
	}
};

const OG_KIND_SET = new Set<OgKind>(Object.values(OgKind));

function isOgKind(value: string): value is OgKind {
	return OG_KIND_SET.has(value as OgKind);
}

export function getOgConfig(kind?: OgKind | null): OgConfig {
	if (kind && OG_KIND_SET.has(kind)) {
		return OG_CONFIG[kind];
	}

	return OG_CONFIG[OgKind.Base];
}

export function parseOgKind(kind?: string | null): OgKind {
	const normalized = kind?.trim().toLowerCase() ?? '';
	if (isOgKind(normalized)) {
		return normalized;
	}
	return OgKind.Base;
}
export { OgKind };

