import { definePageMetaTags } from 'svelte-meta-tags';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
	const pageTags = definePageMetaTags({
		title: 'Backend Information',
		description: 'Detailed information about the Chithi backend instance.',
		openGraph: {
			title: 'Backend Information',
			description: 'Detailed information about the Chithi backend instance.'
		}
	});

	return { ...pageTags };
};
