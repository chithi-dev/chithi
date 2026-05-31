import { definePageMetaTags } from 'svelte-meta-tags';
import type { PageLoad } from './$types';

export const trailingSlash = 'ignore';

export const load: PageLoad = ({ url }) => {
	const ogUrl = new URL('/og/once', url.origin);

	const pageTags = definePageMetaTags({
		title: 'Once',
		description: 'View your file once it is uploaded.',
		openGraph: {
			title: 'Once',
			description: 'View your file once it is uploaded.',
			images: [
				{
					url: ogUrl.toString(),
					width: 1200,
					height: 630,
					alt: 'Once'
				}
			]
		}
	});

	return { ...pageTags };
};
