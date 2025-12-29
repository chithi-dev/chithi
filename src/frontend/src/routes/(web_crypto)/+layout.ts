import { error } from '@sveltejs/kit';
import { is_web_crypto_available } from '$lib/functions/compatibility';
import type { LayoutLoad } from '../$types';
import { browser } from '$app/environment';

export const load: LayoutLoad = (event) => {
	if (browser) {
		if (!is_web_crypto_available()) {
			error(500, {
				message: 'WebCrypto API is not available',
				code: 'WEBCRYPTO_UNAVAILABLE'
			});
		}
	}
};
