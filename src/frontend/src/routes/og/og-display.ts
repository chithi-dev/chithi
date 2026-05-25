import { getOgConfig } from './og-config';

export type OgInputs = {
	kind?: string | null;
	label?: string | null;
	title?: string | null;
	description?: string | null;
	filename?: string | null;
	size?: string | null;
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

	const subtitle = config.usesFileMeta
		? `Size: ${trimOr(inputs.size, 'Unknown size')}`
		: trimOr(inputs.description, config.description ?? '').slice(0, 90);

	return {
		label,
		title,
		subtitle,
		footerTags: config.footerTags
	};
}
