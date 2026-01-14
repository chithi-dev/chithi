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
