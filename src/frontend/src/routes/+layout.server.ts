import { TOKEN_VALIDATE_URL } from '#consts/backend';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ cookies, fetch }) => {
	const token = cookies.get('access_token');

	const res = await fetch(TOKEN_VALIDATE_URL, {
		credentials: 'include'
	});
	if (res.status !== 200) {
		cookies.delete('access_token', { path: '/' });
	}

	let user = null;
	if (token) {
		user = true;
	}

	return { user };
};
