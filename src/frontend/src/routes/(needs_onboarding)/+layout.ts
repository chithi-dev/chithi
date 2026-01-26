import { ONBOARDING_URL } from '$lib/consts/backend';
import type { LayoutLoad } from './$types';

export const load: LayoutLoad = async ({ parent, fetch }) => {
	const { queryClient } = await parent();

	await queryClient.prefetchQuery({
		queryKey: ['onboarding-status'],
		queryFn: async () => {
			const res = await fetch(ONBOARDING_URL);
			if (!res.ok) {
				throw new Error('Failed to fetch onboarding status');
			}
			return res.json() as Promise<{ onboarded: boolean }>;
		},
		retry: false
	});
};
