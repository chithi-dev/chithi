import { CONFIG_URL } from '$lib/consts/backend';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent, fetch }) => {
	const { queryClient } = await parent();

	await queryClient.prefetchQuery({
		queryKey: ['config'],
		queryFn: async () => {
			const token = localStorage.getItem('auth_token');
			let headers: Record<string, string> = {};
			if (token) {
				headers.Authorization = `Bearer ${token}`;
			}

			const res = await fetch(CONFIG_URL, {
				headers: headers
			});

			return res.json();
		},

		staleTime: 10,
		retry: true
	});
};
