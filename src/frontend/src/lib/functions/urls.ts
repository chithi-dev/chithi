export function resolve_partial_path(path: string) {
	return new URL(path, window.location.href).pathname;
}

export function strip_trailing_slash(input: string) {
	if (!input || input === '/') return input;

	// Split off query string and hash
	const [path, query = ''] = input.split('?');
	const [cleanPath, hash = ''] = path.split('#');

	const normalizedPath = cleanPath.replace(/\/+$/, '');

	return normalizedPath + (query ? '?' + query : '') + (hash ? '#' + hash : '');
}

export function validateRedirectUrl(url: string, origin: string): string {
	try {
		const parsed = new URL(url, origin);

		if (parsed.origin !== origin) {
			throw new Error('External redirects are not allowed.');
		}

		if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
			throw new Error('Invalid protocol.');
		}
		return parsed.pathname + parsed.search + parsed.hash;
	} catch (e) {
		if (e instanceof Error) throw e;
		throw new Error('Malformed redirect URL.');
	}
}
