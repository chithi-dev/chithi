import { md5 } from 'hash-wasm';

export async function make_libravatar_url(email: string) {
	const hash = await md5(email);
	return `https://seccdn.libravatar.org/avatar/${hash}?s=512`;
}
