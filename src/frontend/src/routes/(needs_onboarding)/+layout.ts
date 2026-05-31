import { prefetch } from '#queries/onboarding';
import type { LayoutLoad } from './$types';

export const load: LayoutLoad = async ({ parent, fetch }) => {
	prefetch({ queryClient: (await parent()).queryClient, fetch });
};
