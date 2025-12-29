export function is_web_crypto_available() {
	if (window.crypto && window.crypto.subtle) {
		// https check
		if (window.isSecureContext) {
			return true; // Full WebCrypto access
		} else {
			console.warn('WebCrypto is available but context is not secure (HTTPS required).');
			return false;
		}
	} else {
		console.warn('WebCrypto API is not available in this browser.');
		return false;
	}
}

export async function is_minimal_crypto_supported() {
	try {
		// Check AES-256-GCM
		await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);

		// Check HKDF-SHA-512
		await crypto.subtle.generateKey({ name: 'HKDF', hash: 'SHA-512' }, true, ['deriveKey']);

		// Check PBKDF2-HMAC-SHA-256
		const keyMaterial = await crypto.subtle.importKey(
			'raw',
			new Uint8Array([0x00]),
			'PBKDF2',
			false,
			['deriveBits']
		);
		await crypto.subtle.deriveBits(
			{
				name: 'PBKDF2',
				hash: 'SHA-256',
				salt: new Uint8Array([0x00]),
				iterations: 1
			},
			keyMaterial,
			256
		);

		// All checks passed
		return true;
	} catch (e) {
		// Any failure → not supported
		return false;
	}
}
