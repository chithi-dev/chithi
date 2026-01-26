import { CONFIG_URL } from '$lib/consts/backend';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent, fetch }) => {
	const { queryClient } = await parent();

	await queryClient.prefetchQuery({
		queryKey: ['config'],
		queryFn: async () => {
			const res = await fetch(CONFIG_URL);

			return res.json();
		},

		staleTime: 10,
		retry: true
	});
};
