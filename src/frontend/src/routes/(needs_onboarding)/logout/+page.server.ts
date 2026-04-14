import { logout } from '$lib/remote/auth.remote';
import { redirect } from '@sveltejs/kit';
import { validateRedirectUrl } from '$lib/functions/urls';

export const actions = {
	default: async ({ url }) => {
		await logout();

		let next = url.searchParams.get('next') ?? '/';
		try {
			next = validateRedirectUrl(next, url.origin);
		} catch {
			next = '/';
		}

		if (next.startsWith('/admin')) {
			next = '/';
		}
		throw redirect(303, next);
	}
};
