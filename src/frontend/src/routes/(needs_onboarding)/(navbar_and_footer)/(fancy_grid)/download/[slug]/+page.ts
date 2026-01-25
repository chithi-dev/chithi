import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ url }) => {
	// Prefer key from URL fragment (hash), fallback to legacy ?secret= query param
	const hash = url.hash ? url.hash.slice(1) : null;
	const key = hash || url.searchParams.get('secret');
	/*	const key = url.hash ? url.hash.slice(1) : null;*/ // Remove this to always use hash for key
	if (!key) {
		throw error(400, {
			code: 'MISSING_KEY',
			message:
				'The URL is missing the decryption key required to access this file. Please ensure you have the complete link.'
		});
	}
	return {
		key
	};
};
