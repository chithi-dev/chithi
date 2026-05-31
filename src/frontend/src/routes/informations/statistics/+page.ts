import { prefetchInstanceStatistics } from '$lib/queries/instance';
import { definePageMetaTags } from 'svelte-meta-tags';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, parent, url }) => {
	const og = new URL('/og/info', url.origin);
	og.searchParams.set('label', 'PERFORMANCE METRICS');
	og.searchParams.set('title', 'Instance Statistics');
	const { queryClient } = await parent();
	await prefetchInstanceStatistics({ queryClient, fetch });
	const header = {
		subtitle: og.searchParams.get('label')!,
		title: og.searchParams.get('title')!,
		description: 'Real-time instance metrics, storage usage, and system health.'
	};
	return {
		...definePageMetaTags({
			title: 'Instance Statistics',
			description: 'Real-time metrics, storage usage, and system health information.',
			openGraph: {
				title: 'Instance Statistics',
				images: [{ url: og.toString(), width: 1200, height: 630 }]
			}
		}),
		header
	};
};
