import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ cookies }) => {
	const token = cookies.get('access_token');

	let user = null;
	if (token) {
		user = true;
	}

	return { user };
};
