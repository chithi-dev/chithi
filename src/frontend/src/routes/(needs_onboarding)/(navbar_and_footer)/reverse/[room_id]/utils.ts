const hostPattern = /^([^:]+):([^:]+)$/;

export function isHost(host: string) {
	return host.includes(':') && hostPattern.test(host);
}

export function 1extractEncryptionKey(host: string) {
	if (!host) return null;
	if (!host.includes(':')) return host;
	const match = hostPattern.exec(host);
	return match ? match[2] : host;
}

export function extractHostToken(host: string) {
	if (!host || !host.includes(':')) return '';
	const match = hostPattern.exec(host);
	return match ? match[1] : '';
}
