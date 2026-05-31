const p = /^(?<token>[^:]+):(?<key>[^:]+)$/;
export const isHost = (h: string) => h.includes(':') && p.test(h);
export const extractEncryptionKey = (h: string) => {
	if (!h.includes(':')) return h || null;
	return p.exec(h)?.groups?.key ?? h;
};
export const extractHostToken = (h: string) => {
	if (!h.includes(':')) return '';
	return p.exec(h)?.groups?.token ?? '';
};
