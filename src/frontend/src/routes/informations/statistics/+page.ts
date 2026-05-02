import { prefetchInstanceStatistics } from '$lib/queries/instance';
import { definePageMetaTags } from 'svelte-meta-tags';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, parent }) => {
	const pageTags = definePageMetaTags({
		title: 'Instance Statistics',
		description: 'Real-time metrics, storage usage, and system health information.',
		openGraph: {
			title: 'Instance Statistics',
			description: 'Real-time metrics, storage usage, and system health information.'
		}
	});

	const { queryClient } = await parent();
	await prefetchInstanceStatistics({
		queryClient: queryClient,
		fetch
	});

	return {
		...pageTags,
		header: {
			subtitle: 'PERFORMANCE METRICS',
			title: 'Instance Statistics',
			description: 'Real-time instance metrics, storage usage, and system health.'
		}
	};
};
