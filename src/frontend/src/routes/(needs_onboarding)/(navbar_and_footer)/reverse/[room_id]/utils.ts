const SEPARATOR = ':';

const splitHost = (host: string) => {
	const separatorIndex = host.indexOf(SEPARATOR);

	if (separatorIndex === -1) {
		return null;
	}

	const token = host.slice(0, separatorIndex);
	const key = host.slice(separatorIndex + 1);

	return { token, key };
};

export const isHost = (host: string): boolean => {
	return host.includes(SEPARATOR);
};

export const extractHostToken = (host: string): string => {
	const parsed = splitHost(host);
	return parsed?.token ?? '';
};

export const extractEncryptionKey = (host: string): string | null => {
	const parsed = splitHost(host);
	return parsed?.key ?? null;
};
