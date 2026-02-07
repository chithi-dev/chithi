import { prefetch } from '#queries/auth';
import type { LayoutLoad } from './$types';

export const load: LayoutLoad = async ({ parent, fetch }) => {
	const { queryClient } = await parent();

	await prefetch({ queryClient: queryClient, fetch });
};
