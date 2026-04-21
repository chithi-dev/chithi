import { definePageMetaTags } from 'svelte-meta-tags';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
	const pageTags = definePageMetaTags({
		title: 'Information',
		description: 'Get information about this chithi instance.',
		openGraph: {
			title: 'Information',
			description: 'Get information about this chithi instance.'
		}
	});

	return { ...pageTags };
};
