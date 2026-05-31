const hostPattern = /^(?<token>[^:]+):(?<key>[^:]+)$/;

export const isHost = (host: string): boolean => !!host?.includes(':') && hostPattern.test(host);

export const extractEncryptionKey = (host: string) => {
	if (!host) return null;
	if (!host.includes(':')) return host;

	return hostPattern.exec(host)?.groups?.key ?? host;
};

export const extractHostToken = (host: string): string => {
	if (!host?.includes(':')) return '';

	return hostPattern.exec(host)?.groups?.token ?? '';
};
