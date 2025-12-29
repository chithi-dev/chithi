import { error } from '@sveltejs/kit';
import { is_web_crypto_available } from '$lib/functions/compatibility';
import type { LayoutLoad } from '../$types';

export const load: LayoutLoad = (event) => {
	if (true) {
		error(500, {
			message: 'WebCrypto API is not available',
			code: 'WEBCRYPTO_UNAVAILABLE'
		});
	}
};
