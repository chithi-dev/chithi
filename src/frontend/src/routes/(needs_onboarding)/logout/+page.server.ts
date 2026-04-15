import { validateRedirectUrl } from '$lib/functions/urls';
import { logout } from '$lib/remote/auth.remote';
import { redirect } from '@sveltejs/kit';

export const actions = {
	default: async ({ url }) => {
		await logout();

		let next = url.searchParams.get('next') ?? '/';
		next = validateRedirectUrl(next, url.origin);

		if (next.startsWith('/admin')) {
			next = '/';
		}
		throw redirect(303, next);
	}
};
