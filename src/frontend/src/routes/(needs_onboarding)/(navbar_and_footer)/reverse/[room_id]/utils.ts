const hostPattern = /^(?:([^:]+):)?([^:]+)$/;

export function isHost(host: string) {
	return hostPattern.test(host);
}

export function extractEncryptionKey(host: string) {
	const match = hostPattern.exec(host);
	if (!match) {
		throw new Error('Invalid host format');
	}
	return match[2];
}

export function extractHostToken(host: string) {
	const match = hostPattern.exec(host);
	if (!match) {
		throw new Error('Invalid host format');
	}
	return match[1]; // undefined if not provided
}
