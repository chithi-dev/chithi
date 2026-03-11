import { prefetch } from '#queries/config';
import { definePageMetaTags } from 'svelte-meta-tags';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent, fetch }) => {
	const { queryClient } = await parent();

	prefetch({ queryClient: queryClient, fetch });

	const pageTags = definePageMetaTags({
		title: 'Upload',
		description: 'Upload files to chithi server',
		openGraph: {
			title: 'Upload',
			description: 'Upload files to chithi server'
		}
	});

	return { ...pageTags };
};
