import { redirect } from '@sveltejs/kit';
import { logout } from '$lib/remote/auth.remote';

export const load = async ({ cookies, url }) => {
	await logout();

	let next = url.searchParams.get('next') ?? '/';
	if (next.startsWith('/admin')) {
		next = '/';
	}
	throw redirect(303, next);
};
