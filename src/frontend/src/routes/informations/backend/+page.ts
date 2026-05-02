import { prefetchInstanceInformation } from '$lib/queries/instance';
import { definePageMetaTags } from 'svelte-meta-tags';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, parent }) => {
	const pageTags = definePageMetaTags({
		title: 'Backend Information',
		description: 'Detailed information about the Chithi backend instance.',
		openGraph: {
			title: 'Backend Information',
			description: 'Detailed information about the Chithi backend instance.'
		}
	});

	const { queryClient } = await parent();
	await prefetchInstanceInformation({
		queryClient: queryClient,
		fetch
	});

	return {
		...pageTags,
		header: {
			subtitle: 'BACKEND INFRASTRUCTURE',
			title: 'Chithi Backend',
			description: 'Runtime environment, service versions, and architectural metadata.'
		}
	};
};
