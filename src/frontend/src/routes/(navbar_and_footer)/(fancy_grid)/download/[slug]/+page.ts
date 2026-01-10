import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ url }) => {
	const key = url.searchParams.get('secret');
	if (!key) {
		error(400, {
			code: 'MISSING_KEY',
			message:
				'The URL is missing the decryption key required to access this file. Please ensure you have the complete link.'
		});
	}
	return {
		key
	};
};
