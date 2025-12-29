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
