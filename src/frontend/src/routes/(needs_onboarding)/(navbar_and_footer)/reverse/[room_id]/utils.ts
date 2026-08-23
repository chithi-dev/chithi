const hostPattern = /^(?<token>[^:]+):(?<key>[^:]+)$/;

const match = (host: string) => hostPattern.exec(host)?.groups;

export const isHost = (host: string): boolean => hostPattern.test(host);
export const extractEncryptionKey = (host: string): string | null => host ? (match(host)?.key ?? host) : null;
export const extractHostToken = (host: string): string => match(host)?.token ?? '';
