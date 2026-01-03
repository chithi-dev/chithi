import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);

	// Add Cross-Origin Isolation headers required for SharedArrayBuffer
	// This is needed for JS7z multi-threaded WASM compression
	response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
	// Use 'credentialless' instead of 'require-corp' to allow external resources
	// while still enabling SharedArrayBuffer
	response.headers.set('Cross-Origin-Embedder-Policy', 'credentialless');

	return response;
};
