import { definePageMetaTags } from 'svelte-meta-tags';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ url }) => {
	const ogUrl = new URL('/og/info', url.origin);
	ogUrl.searchParams.set('label', 'SYSTEM INFORMATION');
	ogUrl.searchParams.set('title', 'Chithi Instance');
	ogUrl.searchParams.set(
		'description',
		'Version, source revision, and runtime metadata for this deployment.'
	);

	const pageTags = definePageMetaTags({
		title: 'Information',
		description: 'Get information about this chithi instance.',
		openGraph: {
			title: 'Information',
			description: 'Get information about this chithi instance.',
			images: [
				{
					url: ogUrl.toString(),
					width: 1200,
					height: 630,
					alt: 'Information'
				}
			]
		}
	});

	return {
		...pageTags,
		header: {
			subtitle: 'SYSTEM INFORMATION',
			title: 'Chithi Instance',
			description: 'Version, source revision, and runtime metadata for this deployment.'
		}
	};
};
