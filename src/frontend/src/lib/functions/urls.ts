export function strip_trailing_slash(input: string) {
	const [path, query = ''] = input.split('?');
	const [cleanPath, hash = ''] = path.split('#');
	const normalized = cleanPath.replace(/\/+$/, '') || '/';
	return normalized + (query ? `?${query}` : '') + (hash ? `#${hash}` : '');
}

export function validateRedirectUrl(url: string, origin: string) {
	const parsed = new URL(url, origin);
	if (parsed.origin !== origin) throw new Error('External redirects are not allowed.');
	if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')
		throw new Error('Invalid protocol.');
	return parsed.pathname + parsed.search + parsed.hash;
}
