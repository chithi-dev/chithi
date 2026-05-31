import { prefetch } from '#queries/onboarding';
import type { LayoutLoad } from './$types';

export const load: LayoutLoad = async ({ parent, fetch }) => {
	const { queryClient } = await parent();

	prefetch({ queryClient: queryClient, fetch });
};
