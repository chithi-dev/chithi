import { prefetchInstanceStatistics } from '$lib/queries/instance';
import { definePageMetaTags } from 'svelte-meta-tags';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, parent, url }) => {
	const ogUrl = new URL('/og/info', url.origin);
	ogUrl.searchParams.set('label', 'PERFORMANCE METRICS');
	ogUrl.searchParams.set('title', 'Instance Statistics');
	ogUrl.searchParams.set(
		'description',
		'Real-time instance metrics, storage usage, and system health.'
	);

	const pageTags = definePageMetaTags({
		title: 'Instance Statistics',
		description: 'Real-time metrics, storage usage, and system health information.',
		openGraph: {
			title: 'Instance Statistics',
			description: 'Real-time metrics, storage usage, and system health information.',
			images: [
				{
					url: ogUrl.toString(),
					width: 1200,
					height: 630,
					alt: 'Instance Statistics'
				}
			]
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
