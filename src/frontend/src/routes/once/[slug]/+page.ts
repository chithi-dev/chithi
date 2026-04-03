import { definePageMetaTags } from 'svelte-meta-tags';
import type { PageLoad } from './$types';

export const trailingSlash = 'ignore';

export const load: PageLoad = () => {
	const pageTags = definePageMetaTags({
		title: 'Once',
		description: 'View your file once it is uploaded.',
		openGraph: {
			title: 'Once',
			description: 'View your file once it is uploaded.'
		}
	});

	return { ...pageTags };
};
