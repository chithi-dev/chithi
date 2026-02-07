import { prefetch } from '#queries/config';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent, fetch }) => {
	const { queryClient } = await parent();

	prefetch({ queryClient: queryClient, fetch });
};
