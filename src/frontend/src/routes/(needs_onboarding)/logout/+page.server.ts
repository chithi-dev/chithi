import { logout } from '$lib/remote/auth.remote';
import { redirect } from '@sveltejs/kit';
import { validateRedirectUrl } from '$lib/utils';

export const actions = {
	default: async ({ url }) => {
		await logout();

		let next = url.searchParams.get('next') ?? '/';
		next = validateRedirectUrl(next, url.origin);
		throw redirect(303, next);
	}
};
