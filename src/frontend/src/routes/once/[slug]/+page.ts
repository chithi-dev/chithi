import { definePageMetaTags } from 'svelte-meta-tags';
import type { PageLoad } from './$types';

export const trailingSlash = 'ignore';

export const load: PageLoad = ({ url }) =>
	definePageMetaTags({
		title: 'Once',
		description: 'View your file once it is uploaded.',
		openGraph: {
			title: 'Once',
			images: [
				{
					url: new URL('/og/once', url.origin).toString(),
					width: 1200,
					height: 630
				}
			]
		}
	});
