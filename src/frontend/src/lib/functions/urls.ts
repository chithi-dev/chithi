export function resolve_partial_path(path: string) {
	return new URL(path, window.location.href).pathname;
}
