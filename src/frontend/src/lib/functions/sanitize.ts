export function sanitizeExt(ext: string): string {
	return ext.replace(/^\./, '').trim().toLowerCase();
}
