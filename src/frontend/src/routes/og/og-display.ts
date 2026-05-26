import type { OgConfig, OgDisplay, OgInputs } from './og-types';

const trimOr = (value: string | null | undefined, fallback: string) => value?.trim() || fallback;

export const buildOgDisplay = (config: OgConfig, inputs: OgInputs): OgDisplay => {
	const label = config.labelFromQuery ? trimOr(inputs.label, config.label) : config.label;

	const title = (
		config.usesFileMeta
			? trimOr(inputs.filename, 'Encrypted File')
			: trimOr(inputs.title, config.title || 'Chithi')
	).slice(0, 42);

	const fileCount = Number.isFinite(inputs.fileCount) ? inputs.fileCount : null;

	const fileCountLabel = fileCount && fileCount > 0 ? ` | Files: ${fileCount}` : '';

	const subtitle = config.usesFileMeta
		? `Size: ${trimOr(inputs.size, 'Unknown size')}${fileCountLabel}`
		: trimOr(inputs.description, config.description || '').slice(0, 90);

	return {
		label,
		title,
		subtitle,
		footerTags: config.footerTags
	};
};
