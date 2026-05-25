import { getOgConfig } from './og-config';
import { OgKind } from './og-enums';

export type OgInputs = {
	kind?: OgKind | null;
	label?: string | null;
	title?: string | null;
	description?: string | null;
	filename?: string | null;
	size?: string | null;
	fileCount?: number | null;
};

export type OgDisplay = {
	label: string;
	title: string;
	subtitle: string;
	footerTags?: string[];
};

function trimOr(value: string | null | undefined, fallback: string) {
	const cleaned = value?.trim();
	return cleaned ? cleaned : fallback;
}

export function buildOgDisplay(inputs: OgInputs): OgDisplay {
	const config = getOgConfig(inputs.kind);

	const label = config.labelFromQuery ? trimOr(inputs.label, config.label) : config.label;

	const title = config.usesFileMeta
		? trimOr(inputs.filename, 'Encrypted File').slice(0, 42)
		: trimOr(inputs.title, config.title ?? 'Chithi').slice(0, 42);

	const fileCount =
		typeof inputs.fileCount === 'number' && Number.isFinite(inputs.fileCount)
			? inputs.fileCount
			: null;
	const fileCountLabel = fileCount && fileCount > 0 ? ` | Files: ${fileCount}` : '';
	const subtitle = config.usesFileMeta
		? `Size: ${trimOr(inputs.size, 'Unknown size')}${fileCountLabel}`
		: trimOr(inputs.description, config.description ?? '').slice(0, 90);

	return {
		label,
		title,
		subtitle,
		footerTags: config.footerTags
	};
}
