import { definePageMetaTags } from 'svelte-meta-tags';
import type { PageLoad } from './$types';

export const load: PageLoad = () => {
	const pageTags = definePageMetaTags({
		title: 'Landing Page',
		description: 'Check the functionalities of this chithi instance',
		openGraph: {
			title: 'Landing Page',
			description: 'Check the functionalities of this chithi instance'
		}
	});

	return { ...pageTags };
};
