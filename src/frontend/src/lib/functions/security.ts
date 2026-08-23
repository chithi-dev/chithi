async function sha256(message: string) {
	const msgBuffer = new TextEncoder().encode(message);
	const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
	const hashArray = [...new Uint8Array(hashBuffer)];
	return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export { sha256 as hashSHA256 };
