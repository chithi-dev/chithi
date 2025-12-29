import { hashSHA256 } from './security';

export async function make_libravatar_url(email: string) {
	const hash = await hashSHA256(email);
	return `https://seccdn.libravatar.org/avatar/${hash}?s=512`;
}
