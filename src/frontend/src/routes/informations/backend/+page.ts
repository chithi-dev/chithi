import { prefetchInstanceInformation } from '$lib/queries/instance';
import { definePageMetaTags } from 'svelte-meta-tags';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, parent, url }) => {
	const ogUrl = new URL('/og/info', url.origin);
	ogUrl.searchParams.set('label', 'BACKEND INFRASTRUCTURE');
	ogUrl.searchParams.set('title', 'Chithi Backend');
	ogUrl.searchParams.set(
		'description',
		'Runtime environment, service versions, and architectural metadata.'
	);

	const pageTags = definePageMetaTags({
		title: 'Backend Information',
		description: 'Detailed information about the Chithi backend instance.',
		openGraph: {
			title: 'Backend Information',
			description: 'Detailed information about the Chithi backend instance.',
			images: [
				{
					url: ogUrl.toString(),
					width: 1200,
					height: 630,
					alt: 'Backend Information'
				}
			]
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
