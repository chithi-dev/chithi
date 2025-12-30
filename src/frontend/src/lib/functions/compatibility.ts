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
		const ikm = crypto.getRandomValues(new Uint8Array(32)); // Input key material = ikm
		const baseKey = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, [
			'deriveKey',
			'deriveBits'
		]);
		await crypto.subtle.deriveBits(
			{
				name: 'HKDF',
				hash: 'SHA-512',
				salt: crypto.getRandomValues(new Uint8Array(16)),
				info: new Uint8Array([1, 2, 3])
			},
			baseKey,
			256
		);

		// Check PBKDF2-HMAC-SHA-512
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
				hash: 'SHA-512',
				salt: new Uint8Array([0x00]),
				iterations: 1
			},
			keyMaterial,
			256
		);

		// All checks passed
		return true;
	} catch (e) {
		console.log(e);
		// Any failure → not supported
		return false;
	}
}
