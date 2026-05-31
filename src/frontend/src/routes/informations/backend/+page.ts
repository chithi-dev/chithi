import { prefetchInstanceInformation } from '$lib/queries/instance';
import { definePageMetaTags } from 'svelte-meta-tags';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, parent, url }) => {
	const og = new URL('/og/info', url.origin);
	og.searchParams.set('label', 'BACKEND INFRASTRUCTURE');
	og.searchParams.set('title', 'Chithi Backend');
	const { queryClient } = await parent();
	await prefetchInstanceInformation({ queryClient, fetch });
	const header = {
		subtitle: og.searchParams.get('label')!,
		title: og.searchParams.get('title')!,
		description: 'Runtime environment, service versions, and architectural metadata.'
	};
	return {
		...definePageMetaTags({
			title: 'Backend Information',
			description: 'Detailed information about the Chithi backend instance.',
			openGraph: {
				title: 'Backend Information',
				images: [{ url: og.toString(), width: 1200, height: 630 }]
			}
		}),
		header
	};
};
