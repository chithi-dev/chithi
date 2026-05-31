import { prefetch } from '#queries/config';
import { definePageMetaTags } from 'svelte-meta-tags';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent, fetch, url }) => {
	const { queryClient } = await parent();
	prefetch({ queryClient, fetch });
	return definePageMetaTags({
		title: 'Upload',
		description: 'Upload files to chithi server',
		openGraph: {
			title: 'Upload',
			images: [{ url: new URL('/og/upload', url.origin).toString(), width: 1200, height: 630 }]
		}
	});
};
