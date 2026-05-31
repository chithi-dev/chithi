import { prefetch } from '#queries/config';
import { definePageMetaTags } from 'svelte-meta-tags';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent, fetch }) => {
	prefetch({ queryClient: await parent().then((p) => p), fetch });
	return definePageMetaTags({
		title: 'Reverse',
		description: 'Reverse share files using this page'
	});
};
