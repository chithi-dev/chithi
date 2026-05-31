import { definePageMetaTags } from 'svelte-meta-tags';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ url }) => {
	const ogUrl = new URL('/og/speedtest', url.origin);

	const pageTags = definePageMetaTags({
		title: 'Speedtest',
		description: 'Test your internet connection speed with chithi server',
		openGraph: {
			title: 'Speedtest',
			description: 'Test your internet connection speed with chithi server',
			images: [
				{
					url: ogUrl.toString(),
					width: 1200,
					height: 630,
					alt: 'Network Speedtest'
				}
			]
		}
	});

	return { ...pageTags };
};
