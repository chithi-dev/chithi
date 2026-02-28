import { definePageMetaTags } from 'svelte-meta-tags';
import type { PageLoad } from './$types';

export const load: PageLoad = () => {
	const pageTags = definePageMetaTags({
		title: 'Logout',
		description: 'Logout of your chithi instance.',
		openGraph: {
			title: 'Logout',
			description: 'Logout of your chithi instance.'
		}
	});

	return { ...pageTags };
};
