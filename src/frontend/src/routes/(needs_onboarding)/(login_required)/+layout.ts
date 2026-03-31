import { prefetch } from '#queries/auth';
import type { LayoutLoad } from './$types';

// Admin panel dont need SSR, CSR works fine
export const ssr = false;

export const load: LayoutLoad = async ({ parent, fetch }) => {
	const { queryClient } = await parent();

	prefetch({ queryClient: queryClient, fetch });
};
