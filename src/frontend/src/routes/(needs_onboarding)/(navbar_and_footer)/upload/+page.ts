import { prefetch } from '#queries/config';
import { definePageMetaTags } from 'svelte-meta-tags';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent, fetch, url }) => {
	const { queryClient } = await parent();

	prefetch({ queryClient: queryClient, fetch });

	const ogUrl = new URL('/og/upload', url.origin);

	const pageTags = definePageMetaTags({
		title: 'Upload',
		description: 'Upload files to chithi server',
		openGraph: {
			title: 'Upload',
			description: 'Upload files to chithi server',
			images: [
				{
					url: ogUrl.toString(),
					width: 1200,
					height: 630,
					alt: 'Upload Files'
				}
			]
		}
	});

	return { ...pageTags };
};
