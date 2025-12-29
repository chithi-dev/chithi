import { error } from '@sveltejs/kit';
import { is_web_crypto_available, is_minimal_crypto_supported } from '$lib/functions/compatibility';
import type { LayoutLoad } from '../$types';

export const ssr = false;

export const load: LayoutLoad = async () => {
	if (!is_web_crypto_available()) {
		error(500, {
			message: 'WebCrypto API is not available',
			code: 'WEBCRYPTO_UNAVAILABLE'
		});
	}

	const minimalCryptoSupport = await is_minimal_crypto_supported();
	if (!minimalCryptoSupport) {
		error(500, {
			message: 'Browser does not support modern WebCrypto methods',
			code: 'BROWSER_NOT_UPDATED'
		});
	}
};
