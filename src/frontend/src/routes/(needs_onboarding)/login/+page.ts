import { definePageMetaTags } from 'svelte-meta-tags';
import type { PageLoad } from './$types';

export const load: PageLoad = () => {
	const pageTags = definePageMetaTags({
		title: 'Login',
		description: 'Login to your chithi instance.',
		openGraph: {
			title: 'Login',
			description: 'Login to your chithi instance.'
		}
	});

	return { ...pageTags };
};
