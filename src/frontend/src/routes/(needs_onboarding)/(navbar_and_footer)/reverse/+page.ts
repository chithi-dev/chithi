import { prefetch } from '#queries/config';
import { definePageMetaTags } from 'svelte-meta-tags';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent, fetch }) => {
	const { queryClient } = await parent();
	prefetch({ queryClient, fetch });
	return definePageMetaTags({
		title: 'Reverse',
		description: 'Reverse share files using this page'
	});
};
