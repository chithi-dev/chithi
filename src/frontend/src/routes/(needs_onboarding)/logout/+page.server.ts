import { redirect } from '@sveltejs/kit';

export const load = async ({ cookies, url }) => {
	cookies.delete('access_token', { path: '/' });

	let next = url.searchParams.get('next') ?? '/';
	if (next.startsWith('/admin')) {
		next = '/';
	}
	throw redirect(303, next);
};
