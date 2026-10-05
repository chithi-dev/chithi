import { definePageMetaTags } from 'svelte-meta-tags';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent, fetch }) => {
	const pageTags = definePageMetaTags({
		title: 'Reverse',
		description: 'Reverse share files with other using this page',
		openGraph: {
			title: 'Reverse',
			description: 'Reverse share files with other using this page'
		}
	});
	return { ...pageTags };
};
