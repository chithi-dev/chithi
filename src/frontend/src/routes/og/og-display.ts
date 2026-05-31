import type { OgConfig, OgInputs } from './og-types';
const t = (v: string | null | undefined, fb: string) => v?.trim() || fb;
export function buildOgDisplay(c: OgConfig, i: OgInputs) {
	const label = c.labelFromQuery ? t(i.label, c.label) : c.label;
	const title = (
		c.usesFileMeta ? t(i.filename, 'Encrypted File') : t(i.title, c.title || 'Chithi')
	).slice(0, 42);
	const fc = Number.isFinite(i.fileCount!) ? i.fileCount : null;
	const sub = c.usesFileMeta
		? `Size: ${t(i.size, 'Unknown size')}${fc ? ` | Files: ${fc}` : ''}`
		: t(i.description, c.description || '').slice(0, 90);
	return { label, title, subtitle: sub, footerTags: c.footerTags };
}
