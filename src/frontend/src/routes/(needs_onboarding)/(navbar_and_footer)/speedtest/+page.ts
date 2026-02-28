import { definePageMetaTags } from 'svelte-meta-tags';
import type { PageLoad } from './$types';

export const load: PageLoad = () => {
	const pageTags = definePageMetaTags({
		title: 'Speedtest',
		description: 'Test your internet connection speed with chithi server',
		openGraph: {
			title: 'Speedtest',
			description: 'Test your internet connection speed with chithi server'
		}
	});

	return { ...pageTags };
};
