import type { OgConfig, OgInputs } from './og-types';

const getValidString = (value: string | null | undefined, fallback: string): string =>
	value?.trim() || fallback;

export function buildOgDisplay(config: OgConfig, inputs: OgInputs) {
	const {
		labelFromQuery,
		label: configLabel,
		usesFileMeta,
		title: configTitle,
		description: configDescription,
		footerTags
	} = config;
	const {
		label: inputLabel,
		filename,
		title: inputTitle,
		size,
		description: inputDescription,
		fileCount
	} = inputs;

	const label = labelFromQuery ? getValidString(inputLabel, configLabel) : configLabel;

	const rawTitle = usesFileMeta
		? getValidString(filename, 'Encrypted File')
		: getValidString(inputTitle, configTitle || 'Chithi');
	const title = rawTitle.slice(0, 42);

	let subtitle = '';
	if (usesFileMeta) {
		const sizeStr = getValidString(size, 'Unknown size');
		const countStr = Number.isFinite(fileCount) ? ` | Files: ${fileCount}` : '';
		subtitle = `Size: ${sizeStr}${countStr}`;
	} else {
		subtitle = getValidString(inputDescription, configDescription || '').slice(0, 90);
	}

	return {
		label,
		title,
		subtitle,
		footerTags
	};
}
