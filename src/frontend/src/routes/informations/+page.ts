import { definePageMetaTags } from 'svelte-meta-tags';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ url }) => {
	const ogUrl = new URL('/og/info', url.origin);
	ogUrl.searchParams.set('label', 'INSTANCE OVERVIEW');
	ogUrl.searchParams.set('title', 'System Information');
	ogUrl.searchParams.set(
		'description',
		'Explore the infrastructure, performance metrics, and configuration of your Chithi deployment.'
	);

	const pageTags = definePageMetaTags({
		title: 'Instance Information',
		description:
			'Overview of this Chithi instance, including backend, frontend, and system statistics.',
		openGraph: {
			title: 'Instance Information',
			description:
				'Overview of this Chithi instance, including backend, frontend, and system statistics.',
			images: [
				{
					url: ogUrl.toString(),
					width: 1200,
					height: 630,
					alt: 'Instance Information'
				}
			]
		}
	});

	return {
		...pageTags,
		header: {
			subtitle: 'INSTANCE OVERVIEW',
			title: 'System Information',
			description:
				'Explore the infrastructure, performance metrics, and configuration of your Chithi deployment.'
		}
	};
};
