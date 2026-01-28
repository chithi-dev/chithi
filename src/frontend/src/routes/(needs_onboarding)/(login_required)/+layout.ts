import { USER_URL } from '$lib/consts/backend';
import type { LayoutLoad } from './$types';

export const load: LayoutLoad = async ({ parent, fetch }) => {
	const { queryClient } = await parent();

	await queryClient.prefetchQuery({
		queryKey: ['auth-user'],
		queryFn: async () => {
			const token = localStorage.getItem('auth_token');
			if (!token) return null;

			const res = await fetch(USER_URL, {
				headers: { Authorization: `Bearer ${token}` }
			});

			if (!res.ok || res.status === 401) {
				localStorage.removeItem('auth_token');
				return null;
			}
			return res.json();
		},
		staleTime: Infinity,
		retry: false
	});
};
