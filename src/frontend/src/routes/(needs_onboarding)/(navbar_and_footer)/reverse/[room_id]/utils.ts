const SEP = ':';

export const isHost = (h = '') => h.indexOf(SEP) !== -1;

export const extractHostToken = (h = '') => {
	const i = h.indexOf(SEP);
	return i === -1 ? '' : h.slice(0, i);
};

export const extractEncryptionKey = (h = '') => {
	const i = h.indexOf(SEP);
	return i === -1 ? null : h.slice(i + 1);
};
