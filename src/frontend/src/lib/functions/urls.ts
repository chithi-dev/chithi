export const resolve_partial_path = (path: string) => new URL(path, window.location.href).pathname;

export const strip_trailing_slash = (input: string) => {
	if (!input || input === '/') return input;

	const [path, query = ''] = input.split('?');
	const [cleanPath, hash = ''] = path.split('#');

	const normalizedPath = cleanPath.replace(/\/+$/, '');

	return normalizedPath + (query ? '?' + query : '') + (hash ? '#' + hash : '');
};

export const validateRedirectUrl = (url: string, origin: string): string => {
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
};
